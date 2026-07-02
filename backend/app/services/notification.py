import httpx
from typing import Optional, List, Dict, Any

class NotificationService:
    def __init__(self):
        # Initialized HTTP client for sending notifications
        self.client = httpx.Client(timeout=5.0)

    def send_slack_message(self, webhook_url: str, text: str, attachments: Optional[List[Dict[str, Any]]] = None) -> bool:
        """
        Send a notification payload to a Slack incoming webhook.
        """
        if not webhook_url:
            print("[Notification] Webhook URL missing. Skipping Slack post.")
            return False
            
        payload = {
            "text": text
        }
        if attachments:
            payload["attachments"] = attachments

        try:
            response = self.client.post(webhook_url, json=payload)
            if response.status_code == 200:
                print(f"[Notification] Slack message posted successfully to webhook.")
                return True
            else:
                print(f"[Notification] Slack post failed (HTTP {response.status_code}): {response.text}")
                return False
        except Exception as e:
            print(f"[Notification] Slack post connection failed: {e}")
            return False

    def send_generic_webhook(self, target_url: str, payload: Dict[str, Any]) -> bool:
        """
        Send a generic JSON payload POST request to a custom webhook URL.
        """
        if not target_url:
            print("[Notification] Target webhook URL missing. Skipping generic webhook.")
            return False

        try:
            response = self.client.post(target_url, json=payload)
            if response.status_code in [200, 201, 202, 204]:
                print(f"[Notification] Generic webhook triggered successfully (HTTP {response.status_code}).")
                return True
            else:
                print(f"[Notification] Generic webhook failed (HTTP {response.status_code}): {response.text}")
                return False
        except Exception as e:
            print(f"[Notification] Generic webhook connection failed: {e}")
            return False

notification_service = NotificationService()
