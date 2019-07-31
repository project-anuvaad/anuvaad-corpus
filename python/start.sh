export FLASK_RUN_PORT=5001
export FLASK_APP=app.py
export app_debug_logs=False
nohup  python3 -m flask run --with-threads &

