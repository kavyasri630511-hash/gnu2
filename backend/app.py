import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from postgrest import APIError
from supabase import Client, create_client

load_dotenv(Path(__file__).with_name(".env"))

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_PUBLISHABLE_KEY")
if not supabase_url or not supabase_key:
    raise RuntimeError(
        "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set in the environment"
    )

app = Flask(__name__)

supabase: Client = create_client(
    supabase_url,
    supabase_key,
)


@app.after_request
def add_cors_headers(response):
    """Allow browser clients from any origin to call this API."""
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


def api_error(error, status=500):
    return jsonify({"error": str(error)}), status


@app.get("/")
def index():
    return jsonify({"message": "Events API"})


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/events")
def list_events():
    query = supabase.table("events").select("id,organizer_id,title,capacity,status")
    event_status = request.args.get("status")
    if event_status:
        query = query.eq("status", event_status)
    try:
        response = query.execute()
        return jsonify(response.data)
    except APIError as error:
        return api_error(error)


@app.get("/api/events/<event_id>")
def get_event(event_id):
    try:
        response = (
            supabase.table("events")
            .select("id,organizer_id,title,capacity,status")
            .eq("id", event_id)
            .limit(1)
            .execute()
        )
        if not response.data:
            return api_error("Event not found", 404)
        return jsonify(response.data[0])
    except APIError as error:
        return api_error(error)


@app.post("/api/registrations")
def create_registration():
    body = request.get_json(silent=True) or {}
    user_id = body.get("user_id")
    event_id = body.get("event_id")
    if not user_id or not event_id:
        return api_error("user_id and event_id are required", 400)

    try:
        event_response = (
            supabase.table("events")
            .select("id,capacity,status")
            .eq("id", event_id)
            .limit(1)
            .execute()
        )
        if not event_response.data:
            return api_error("Event not found", 404)

        event = event_response.data[0]
        registrations = (
            supabase.table("registrations")
            .select("id", count="exact")
            .eq("event_id", event_id)
            .execute()
        )
        if event.get("capacity") is not None and (registrations.count or 0) >= event["capacity"]:
            return api_error("Event is full", 409)

        existing = (
            supabase.table("registrations")
            .select("id")
            .eq("user_id", user_id)
            .eq("event_id", event_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            return api_error("You are already registered for this event", 409)

        result = (
            supabase.table("registrations")
            .insert({"user_id": user_id, "event_id": event_id})
            .execute()
        )
        return jsonify(result.data[0] if result.data else {}), 201
    except APIError as error:
        # The schema's unique constraint on (user_id, event_id) identifies duplicates.
        if getattr(error, "code", None) == "23505":
            return api_error("You are already registered for this event", 409)
        return api_error(error)


@app.get("/api/me/registrations")
def my_registrations():
    # Authentication is intentionally disabled; clients provide the user ID.
    user_id = request.args.get("user_id")
    if not user_id:
        return api_error("user_id query parameter is required", 400)
    try:
        response = (
            supabase.table("registrations")
            .select("id,user_id,event_id,created_at,events(id,title,organizer_id,capacity,status)")
            .eq("user_id", user_id)
            .execute()
        )
        return jsonify(response.data)
    except APIError as error:
        return api_error(error)


@app.get("/api/events/<event_id>/registrations")
def event_registrations(event_id):
    # With authentication disabled, organizer_id is a caller-supplied claim and
    # cannot prove ownership. This check only compares it to the event row.
    organizer_id = request.args.get("organizer_id")
    if not organizer_id:
        return api_error("organizer_id query parameter is required", 400)
    try:
        event_response = (
            supabase.table("events")
            .select("id,organizer_id")
            .eq("id", event_id)
            .limit(1)
            .execute()
        )
        if not event_response.data:
            return api_error("Event not found", 404)
        if event_response.data[0]["organizer_id"] != organizer_id:
            return api_error("Only the event organizer can view registrations", 403)

        response = (
            supabase.table("registrations")
            .select("id,user_id,event_id,created_at,users(id,email,role)")
            .eq("event_id", event_id)
            .execute()
        )
        return jsonify(response.data)
    except APIError as error:
        return api_error(error)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
