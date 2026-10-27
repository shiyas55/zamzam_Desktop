from decimal import Decimal
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import User
from apps.routes.models import Driver, DriverExpense, Route


class ExpensePaymentMethodTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner_user",
            password="OwnerPassword123!",
            role=User.Role.OWNER,
            phone_number="9876543210"
        )
        self.client.force_authenticate(user=self.owner)
        self.route = Route.objects.create(name="Route A", code="R-A")
        self.driver_user = User.objects.create_user(
            username="driver_user",
            password="DriverPassword123!",
            role=User.Role.DRIVER,
            phone_number="9876543211"
        )
        self.driver = Driver.objects.create(
            user=self.driver_user,
            assigned_route=self.route,
            vehicle_number="KL-10-AB-1234"
        )

    def test_create_cash_and_gpay_expense(self):
        # 1. Create Cash expense
        cash_resp = self.client.post("/api/v1/driver-expenses/", {
            "category": "PETROL_FUEL",
            "amount": "250.00",
            "payment_method": "CASH",
            "date": str(timezone.localdate()),
            "notes": "Cash fuel"
        })
        self.assertEqual(cash_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(cash_resp.data["payment_method"], "CASH")

        # 2. Create GPay expense
        gpay_resp = self.client.post("/api/v1/driver-expenses/", {
            "category": "MAINTENANCE",
            "amount": "500.00",
            "payment_method": "GPAY_UPI",
            "date": str(timezone.localdate()),
            "notes": "GPay vehicle repair"
        })
        self.assertEqual(gpay_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(gpay_resp.data["payment_method"], "GPAY_UPI")

        # 3. Test filter by payment_method
        cash_list = self.client.get("/api/v1/driver-expenses/?payment_method=CASH")
        self.assertEqual(cash_list.status_code, status.HTTP_200_OK)
        results = cash_list.data.get("results", cash_list.data)
        self.assertTrue(all(e["payment_method"] == "CASH" for e in results))

        gpay_list = self.client.get("/api/v1/driver-expenses/?payment_method=GPAY_UPI")
        self.assertEqual(gpay_list.status_code, status.HTTP_200_OK)
        results = gpay_list.data.get("results", gpay_list.data)
        self.assertTrue(all(e["payment_method"] == "GPAY_UPI" for e in results))

        # 4. Test dashboard summary includes cash & gpay breakdown
        summary_resp = self.client.get(f"/api/v1/reports/dashboard/?date={timezone.localdate()}")
        self.assertEqual(summary_resp.status_code, status.HTTP_200_OK)
        data = summary_resp.data
        self.assertIn("today_cash_expenses", data)
        self.assertIn("today_upi_expenses", data)
        self.assertEqual(Decimal(str(data["today_cash_expenses"])), Decimal("250.00"))
        self.assertEqual(Decimal(str(data["today_upi_expenses"])), Decimal("500.00"))
        self.assertEqual(Decimal(str(data["today_expenses"])), Decimal("750.00"))
