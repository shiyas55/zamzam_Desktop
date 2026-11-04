import json
from unittest.mock import patch, MagicMock
from django.test import TestCase
from apps.accounts.models import User
from apps.common.models import SystemSettings
from apps.common.telegram import generate_full_backup_json, dispatch_telegram_backup
from rest_framework.test import APIClient


class TelegramBackupTestCase(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner_test",
            password="password123",
            role="OWNER"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

        self.settings = SystemSettings.objects.first()
        if not self.settings:
            self.settings = SystemSettings.objects.create(
                business_name="Zamzam Test",
                telegram_bot_token="123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
                telegram_chat_id="-1009876543210",
                is_telegram_backup_enabled=True,
                telegram_backup_on_bill_save=True
            )
        else:
            self.settings.telegram_bot_token = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
            self.settings.telegram_chat_id = "-1009876543210"
            self.settings.is_telegram_backup_enabled = True
            self.settings.telegram_backup_on_bill_save = True
            self.settings.save()

    def test_generate_full_backup_json(self):
        json_bytes, checksum, total_records, module_counts = generate_full_backup_json(created_by="UnitTester")
        self.assertGreater(len(json_bytes), 0)
        self.assertGreater(len(checksum), 30)
        data = json.loads(json_bytes.decode("utf-8"))
        self.assertIn("backup_info", data)
        self.assertIn("records", data)
        self.assertEqual(data["backup_info"]["sha256_checksum"], checksum)

    @patch("apps.common.telegram.requests.post")
    def test_dispatch_telegram_backup_success(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"ok": True, "result": {"message_id": 999}}
        mock_post.return_value = mock_resp

        res = dispatch_telegram_backup(trigger="BILL_SAVE", notes="Saved bills", user=self.owner)
        self.assertTrue(res["success"])
        self.assertIn("zamzam_backup_full_", res["filename"])
        self.assertGreater(res["total_records"], 0)

    @patch("apps.common.telegram.requests.post")
    def test_telegram_test_api_view(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"ok": True, "result": {"message_id": 1000}}
        mock_post.return_value = mock_resp

        response = self.client.post("/api/v1/database/telegram-test/", {
            "bot_token": "test_bot_token",
            "chat_id": "-1001234"
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])

    @patch("apps.common.telegram.requests.post")
    def test_telegram_backup_api_view(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"ok": True, "result": {"message_id": 1001}}
        mock_post.return_value = mock_resp

        response = self.client.post("/api/v1/database/telegram-backup/", {
            "trigger": "BILL_SAVE",
            "notes": "Fast order save"
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])

