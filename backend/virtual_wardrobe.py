import os
from flask import Blueprint, request, jsonify, render_template
import json
import sys
from datetime import datetime
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

vir_bp = Blueprint("vir", __name__)

SMTP_SERVER = os.getenv("SMTP_SERVER")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")


def generate_ics_event(schedule_date, upper, lower):
    event = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Virtual Wardrobe//EN
BEGIN:VEVENT
UID:{datetime.now().timestamp()}
DTSTAMP:{datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")}
DTSTART;TZID=Asia/Kolkata:{schedule_date.replace('-', '')}T061500
DTEND;TZID=Asia/Kolkata:{schedule_date.replace('-', '')}T064500
SUMMARY:Your Outfit Reminder
DESCRIPTION:Upper Outfit: {upper['name']}\\n{upper['image']}\\nLower Outfit: {lower['name']}\\n{lower['image']}
END:VEVENT
END:VCALENDAR
"""
    return event


def send_email_with_ics(receiver_email, subject, html_content, ics_content):
    resend_api_key = os.getenv("RESEND_API_KEY")
    if resend_api_key:
        import base64
        import urllib.request

        try:
            ics_base64 = base64.b64encode(ics_content.encode("utf-8")).decode("utf-8")
            from_email = "Zenvia <noreply@zenvia.schedule.com>"
            payload = {
                "from": from_email,
                "to": receiver_email,
                "subject": subject,
                "html": html_content,
                "attachments": [
                    {
                        "content": ics_base64,
                        "filename": "outfit_reminder.ics"
                    }
                ]
            }

            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json"
                },
                method="POST"
            )

            with urllib.request.urlopen(req) as response:
                res_body = response.read().decode("utf-8")
                print(f"Resend API Response: {res_body}", flush=True)

            print(f"Email + ICS sent via Resend to: {receiver_email}", flush=True)
            return True
        except Exception as e:
            print(f"Resend Email failed: {e}", file=sys.stderr, flush=True)
            raise e
    else:
        try:
            msg = MIMEMultipart()
            msg["From"] = SENDER_EMAIL
            msg["To"] = receiver_email
            msg["Subject"] = subject

            msg.attach(MIMEText(html_content, "html"))

            attachment = MIMEText(ics_content, "calendar; method=PUBLISH")
            attachment.add_header(
                "Content-Disposition", "attachment", filename="outfit_reminder.ics"
            )
            msg.attach(attachment)

            if not SMTP_SERVER:
                raise ValueError("SMTP_SERVER environment variable is not configured. Please set it in Hugging Face Repository Secrets or set RESEND_API_KEY.")

            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                server.starttls()
                server.login(SENDER_EMAIL, SENDER_PASSWORD)
                server.send_message(msg)

            print(f"Email + ICS sent via SMTP to: {receiver_email}", flush=True)
            return True

        except Exception as e:
            print(f"ICS Email failed: {e}", file=sys.stderr, flush=True)
            raise e


def create_email_html(schedule_date, upper, lower):
    formatted_date = datetime.strptime(schedule_date, "%Y-%m-%d").strftime("%B %d, %Y")

    return f"""
    <html>
    <body style="font-family: Arial; padding: 20px;">
        <h2 style="color: #4F46E5;">Your Outfit is Scheduled!</h2>
        <p><strong>Date:</strong> {formatted_date}</p>

        <h3>Upper Outfit</h3>
        <p>
            <strong>Name:</strong> {upper['name']}<br>
            <strong>Brand:</strong> {upper['brand']}<br>
            <strong>Type:</strong> {upper['type']}
        </p>
        <img src="{upper['image']}" width="220" style="border-radius: 8px;">

        <h3>Lower Outfit</h3>
        <p>
            <strong>Name:</strong> {lower['name']}<br>
            <strong>Brand:</strong> {lower['brand']}<br>
            <strong>Type:</strong> {lower['type']}
        </p>
        <img src="{lower['image']}" width="220" style="border-radius: 8px;">

        <br><br>
        <p style="color: gray;">A calendar event is attached. Add it to Google Calendar to get the reminder.</p>
    </body>
    </html>
    """


@vir_bp.route("/api/schedule-outfit", methods=["POST"])
def schedule_outfit():
    try:
        data = request.get_json()

        email = data.get("email")
        schedule_date = data.get("schedule_date")

        if not email or not schedule_date:
            return (
                jsonify(
                    {"success": False, "error": "Email and schedule date required"}
                ),
                400,
            )

        upper_data = {
            "name": data.get("upper_name"),
            "brand": data.get("upper_brand"),
            "type": data.get("upper_type"),
            "image": data.get("upper_image"),
        }

        lower_data = {
            "name": data.get("lower_name"),
            "brand": data.get("lower_brand"),
            "type": data.get("lower_type"),
            "image": data.get("lower_image"),
        }

        html_content = create_email_html(schedule_date, upper_data, lower_data)

        ics_event = generate_ics_event(schedule_date, upper_data, lower_data)

        send_email_with_ics(
            email,
            "Your Outfit is Scheduled! (Add to Calendar)",
            html_content,
            ics_event,
        )

        entry = {
            "email": email,
            "schedule_date": schedule_date,
            "upper_data": upper_data,
            "lower_data": lower_data,
            "saved_at": datetime.now().isoformat(),
        }

        try:
            with open("scheduled_outfits.json", "r") as f:
                schedules = json.load(f)
        except:
            schedules = []

        schedules.append(entry)

        with open("scheduled_outfits.json", "w") as f:
            json.dump(schedules, f, indent=4)

        return jsonify({"success": True, "message": "Outfit scheduled + ICS attached!"})

    except Exception as e:
        print("Error in /api/schedule-outfit:", e)
        return jsonify({"success": False, "error": str(e)}), 500


@vir_bp.route("/virtual-wardrobe")
def wardrobe_page():
    return render_template(
        "virtual_wardrobe.html",
        WEATHER_API_KEY=os.getenv("OPENWEATHER_API_KEY", ""),
        CLOUD_NAME=os.getenv("CLOUDINARY_CLOUD_NAME", ""),
        UPLOAD_PRESET=os.getenv("CLOUDINARY_UPLOAD_PRESET", "virtual_wardrobe"),
    )
