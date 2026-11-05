import io
import json
import logging
import hashlib
import requests
from django.utils import timezone
from django.apps import apps
from django.core import serializers
from django.db import connection

logger = logging.getLogger(__name__)

MODULE_MODELS_MAP = {
    "accounts": [
        "accounts.User",
        "accounts.DeviceSession",
        "accounts.StaffMember",
        "accounts.StaffAttendance",
        "accounts.StaffPayout",
    ],
    "products": ["products.Product"],
    "routes": ["routes.Route", "routes.Driver", "routes.DriverShift", "routes.DriverExpense"],
    "customers": ["customers.Customer", "customers.CustomerProductPrice", "customers.CustomerDocument"],
    "orders": ["orders.Order", "orders.OrderItem", "orders.OrderActivityLog"],
    "deliveries": ["deliveries.Delivery"],
    "payments": ["payments.Payment"],
    "credits": ["credits.CreditTransaction"],
    "reports": ["reports.DailyClosing"],
    "whatsapp": [
        "whatsapp.WhatsAppAccount",
        "whatsapp.WhatsAppCustomer",
        "whatsapp.WhatsAppConversation",
        "whatsapp.WhatsAppMessage",
    ],
    "logs": ["common.SystemSettings", "common.BusinessDocument", "common.ActivityLog"],
}


def normalize_telegram_chat_id(chat_id: str) -> str:
    """Ensure Telegram channel / supergroup IDs have leading '-'."""
    cid = str(chat_id or "").strip()
    if cid.startswith("100") and len(cid) >= 12 and not cid.startswith("-"):
        cid = f"-{cid}"
    return cid


def send_telegram_text(bot_token: str, chat_id: str, text: str, parse_mode: str = "HTML") -> dict:
    """Send a plain or HTML formatted message to a Telegram chat/channel."""
    cleaned_chat_id = normalize_telegram_chat_id(chat_id)
    url = f"https://api.telegram.org/bot{bot_token.strip()}/sendMessage"
    payload = {
        "chat_id": cleaned_chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }
    response = requests.post(url, json=payload, timeout=20)
    data = response.json()
    if not response.ok or not data.get("ok"):
        error_desc = data.get("description", response.text)
        hint = ""
        if "chat not found" in error_desc.lower():
            hint = " (Tip: Telegram Channel IDs must start with -100, e.g. -1003405118666, and the Bot MUST be added as an Administrator in your Telegram Channel)"
        elif "not a member" in error_desc.lower() or "administrator" in error_desc.lower():
            hint = " (Tip: Please add your Telegram Bot as an Administrator to the Channel with permission to post messages)"
        raise ValueError(f"Telegram API Error ({response.status_code}): {error_desc}{hint}")
    return data


def send_telegram_document(
    bot_token: str,
    chat_id: str,
    file_bytes: bytes,
    filename: str,
    caption: str = "",
    parse_mode: str = "HTML",
) -> dict:
    """Upload and send a document (JSON backup, file) to a Telegram chat/channel."""
    cleaned_chat_id = normalize_telegram_chat_id(chat_id)
    url = f"https://api.telegram.org/bot{bot_token.strip()}/sendDocument"
    data = {
        "chat_id": cleaned_chat_id,
        "caption": caption[:1024],  # Telegram max caption length
        "parse_mode": parse_mode,
    }
    files = {
        "document": (filename, io.BytesIO(file_bytes), "application/json"),
    }
    response = requests.post(url, data=data, files=files, timeout=45)
    resp_data = response.json()
    if not response.ok or not resp_data.get("ok"):
        error_desc = resp_data.get("description", response.text)
        hint = ""
        if "chat not found" in error_desc.lower():
            hint = " (Tip: Telegram Channel IDs must start with -100, e.g. -1003405118666, and the Bot MUST be added as an Administrator in your Telegram Channel)"
        elif "not a member" in error_desc.lower() or "administrator" in error_desc.lower():
            hint = " (Tip: Please add your Telegram Bot as an Administrator to the Channel with permission to post messages)"
        raise ValueError(f"Telegram API Upload Error ({response.status_code}): {error_desc}{hint}")
    return resp_data


def generate_full_backup_json(target_modules: list = None, created_by: str = "system") -> tuple[bytes, str, int, dict]:
    """
    Export database data into a standard Zamzam backup JSON structure.
    Returns (json_bytes, checksum, total_records, summary_counts).
    """
    if not target_modules:
        target_modules = list(MODULE_MODELS_MAP.keys())

    timestamp_str = timezone.now().strftime("%Y%m%d_%H%M%S")
    db_engine = connection.vendor

    backup_data = {
        "backup_info": {
            "system": "Zamzam Foods Enterprise Distribution Management",
            "version": "1.0.0",
            "created_at": timezone.now().isoformat(),
            "created_by": created_by,
            "backup_type": "full" if len(target_modules) == len(MODULE_MODELS_MAP) else "selective",
            "database_engine": db_engine,
            "included_modules": target_modules,
        },
        "records": {},
    }

    total_exported_count = 0
    module_counts = {}

    for mod_id in target_modules:
        mod_records = []
        for model_path in MODULE_MODELS_MAP.get(mod_id, []):
            try:
                app_label, model_name = model_path.split(".")
                model = apps.get_model(app_label, model_name)
                qs = model.objects.all()
                serialized = serializers.serialize("python", qs)
                mod_records.extend(serialized)
                total_exported_count += len(serialized)
            except Exception as e:
                logger.warning(f"Error serializing model {model_path}: {e}")
                continue
        backup_data["records"][mod_id] = mod_records
        module_counts[mod_id] = len(mod_records)

    backup_data["backup_info"]["total_records"] = total_exported_count

    json_str = json.dumps(backup_data, indent=2, default=str)
    json_bytes = json_str.encode("utf-8")
    checksum = hashlib.sha256(json_bytes).hexdigest()
    backup_data["backup_info"]["sha256_checksum"] = checksum

    # Re-encode with checksum included
    final_json_str = json.dumps(backup_data, indent=2, default=str)
    final_json_bytes = final_json_str.encode("utf-8")

    return final_json_bytes, checksum, total_exported_count, module_counts


def dispatch_telegram_backup(
    trigger: str = "MANUAL",
    notes: str = "",
    user = None,
    force: bool = False,
) -> dict:
    """
    Generates a full backup JSON and dispatches it directly to the configured Telegram bot & chat/channel.
    """
    from apps.common.models import SystemSettings, ActivityLog
    from apps.common.audit import log_activity

    settings = SystemSettings.objects.first()
    if not settings:
        return {"success": False, "skipped": True, "error": "SystemSettings not found"}

    bot_token = (settings.telegram_bot_token or "").strip()
    chat_id = (settings.telegram_chat_id or "").strip()

    if not force:
        if not settings.is_telegram_backup_enabled:
            return {"success": False, "skipped": True, "error": "Telegram backup is disabled in settings"}
        if trigger == "BILL_SAVE" and not settings.telegram_backup_on_bill_save:
            return {"success": False, "skipped": True, "error": "Telegram backup on bill save is disabled"}

    if not bot_token or not chat_id:
        return {
            "success": False,
            "skipped": True,
            "error": "Telegram Bot Token or Chat ID is not configured. Please set them in System Settings.",
        }

    now = timezone.now()
    timestamp_str = now.strftime("%Y%m%d_%H%M%S")
    human_date = now.strftime("%d-%b-%Y %I:%M %p")
    filename = f"zamzam_backup_full_{timestamp_str}.json"

    created_by_str = user.username if (user and hasattr(user, "username")) else (trigger or "System")

    # Generate JSON
    json_bytes, checksum, total_records, module_counts = generate_full_backup_json(created_by=created_by_str)

    # Get quick stats for caption
    orders_count = module_counts.get("orders", 0)
    customers_count = module_counts.get("customers", 0)
    file_size_kb = round(len(json_bytes) / 1024, 1)

    trigger_emojis = {
        "BILL_SAVE": "🧾 <b>Wholesale Bill Saved</b>",
        "MANUAL": "👤 <b>Manual Backup Export</b>",
        "SCHEDULE": "⏰ <b>Scheduled Daily Backup</b>",
    }
    trigger_title = trigger_emojis.get(trigger, f"📦 <b>{trigger} Backup</b>")

    caption = (
        f"🍞 <b>Zamzam Foods — Cloud Database Backup</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"{trigger_title}\n"
        f"📅 <b>Date:</b> {human_date}\n"
        f"📁 <b>File:</b> <code>{filename}</code> ({file_size_kb} KB)\n"
        f"📊 <b>Total Records:</b> {total_records:,}\n"
        f"🏪 <b>Customer Shops:</b> {customers_count}\n"
        f"🛒 <b>Orders in DB:</b> {orders_count}\n"
    )
    if notes:
        caption += f"📝 <b>Note:</b> {notes}\n"
    caption += (
        f"🔐 <b>SHA-256:</b> <code>{checksum[:16]}...</code>\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"✅ <i>Database snapshot safely stored in Telegram Cloud.</i>"
    )

    try:
        telegram_resp = send_telegram_document(
            bot_token=bot_token,
            chat_id=chat_id,
            file_bytes=json_bytes,
            filename=filename,
            caption=caption,
        )

        # Log activity
        if user and user.is_authenticated:
            log_activity(
                user=user,
                action="EXPORTED",
                entity_type="SYSTEM_BACKUP",
                entity_id=f"backup_telegram_{timestamp_str}",
                entity_name="Telegram Cloud Backup",
                summary=f"Sent full JSON backup to Telegram ({total_records} records, {file_size_kb} KB) on trigger {trigger}.",
                details={
                    "format": "json",
                    "trigger": trigger,
                    "total_records": total_records,
                    "file_size_kb": file_size_kb,
                    "checksum": checksum,
                    "filename": filename,
                },
            )

        return {
            "success": True,
            "filename": filename,
            "file_size_kb": file_size_kb,
            "total_records": total_records,
            "checksum": checksum,
            "message": f"Successfully sent backup JSON ({filename}) to Telegram!",
        }
    except Exception as exc:
        logger.error(f"Failed to dispatch Telegram backup: {exc}", exc_info=True)
        return {
            "success": False,
            "error": str(exc),
            "filename": filename,
        }

