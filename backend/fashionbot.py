import os
import requests
from flask import Blueprint, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

fashionbot_bp = Blueprint("fashionbot", __name__)
CORS(fashionbot_bp)

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
PORT = 3000


@fashionbot_bp.route("/api/chat", methods=["POST"])
def chat():
    """
    Endpoint for chatting with the FashionBot.
    Input: JSON with {"message": "<user text>"}
    Output: JSON with {"reply": "<bot response>"}
    """
    try:
        data = request.get_json()
        if not data or "message" not in data:
            return jsonify({"error": "Missing 'message' field"}), 400

        user_message = data["message"]
        print(f"👗 User said: {user_message}")

        if len(user_message.strip()) < 3:
            return jsonify(
                {
                    "response": "Please provide a little more detail so I can help you better."
                }
            )

        url = "https://api.mistral.ai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {MISTRAL_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "mistral-large-latest",
            "temperature": 0.3,
            "max_tokens": 300,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are FashionBot, a fashion stylist. "
                        "Provide concise, practical advice. "
                        "Avoid speculation. Ask for clarification if information is insufficient."
                    ),
                },
                {"role": "user", "content": user_message},
            ],
        }

        response = requests.post(url, headers=headers, json=payload, timeout=10)
        response.raise_for_status()

        bot_reply = response.json()["choices"][0]["message"]["content"]
        print(f"👜 FashionBot: {bot_reply}")

        return jsonify({"response": bot_reply})

    except requests.exceptions.Timeout:
        return jsonify({"error": "FashionBot timed out. Please try again."}), 504
    except requests.exceptions.RequestException:
        return jsonify({"error": "FashionBot service is temporarily unavailable."}), 503
    except Exception as e:
        print("⚠️ Unexpected Error:", e)
        return jsonify({"error": str(e)}), 500


@fashionbot_bp.route("/api", methods=["GET"])
def health_check():
    return jsonify({"status": "FashionBot API active ✅"})


if __name__ == "__main__":
    from flask import Flask

    app = Flask(__name__)
    app.register_blueprint(fashionbot_bp)
    print(f"🚀 FashionBot running on http://localhost:{PORT}")
    app.run(port=PORT, debug=True)
