

echo "🚀 Starting Silver Sands HRMS..."

echo "📦 Installing dependencies..."
pip install -r requirements.txt

if [ -z "$MONGO_URI" ]; then
    echo "❌ MONGO_URI environment variable not set!"
    echo "Please set MONGO_URI in your Render environment variables."
    exit 1
fi

echo "✅ MONGO_URI found"

if [ "$RUN_MIGRATION" = "true" ]; then
    echo "🔄 Running data migration..."
    python migrate.py
fi

echo "🚀 Starting Flask application..."
gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120