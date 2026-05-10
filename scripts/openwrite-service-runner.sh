#!/bin/zsh
set -u

service="${1:-}"
root="/Users/openclaw/Documents/projects/openwrite"
log_dir="${OPENWRITE_SERVICE_LOG_DIR:-/Users/openclaw/Library/Logs/OpenWrite}"

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

timestamp() {
  date "+%Y-%m-%dT%H:%M:%S%z"
}

case "$service" in
  backend|frontend)
    ;;
  *)
    echo "[$(timestamp)] unknown OpenWrite service: ${service:-<missing>}" >&2
    exit 64
    ;;
esac

mkdir -p "$log_dir"
cd "$root" || exit 70

child_pid=""

stop_child() {
  local signal="${1:-TERM}"
  if [[ -n "$child_pid" ]]; then
    echo "[$(timestamp)] openwrite-$service stopping child pid=$child_pid signal=$signal"
    kill "-$signal" "$child_pid" 2>/dev/null || true
    wait "$child_pid" 2>/dev/null || true
  fi
}

handle_signal() {
  local signal="$1"
  echo "[$(timestamp)] openwrite-$service received $signal"
  stop_child TERM
  echo "[$(timestamp)] openwrite-$service stopped after $signal"
  exit 0
}

trap 'handle_signal INT' INT
trap 'handle_signal TERM' TERM

echo "[$(timestamp)] openwrite-$service starting supervisor pid=$$ root=$root"
/usr/local/bin/npm run dev --workspace "$service" &
child_pid="$!"
echo "[$(timestamp)] openwrite-$service child pid=$child_pid"

wait "$child_pid"
child_status="$?"
echo "[$(timestamp)] openwrite-$service child exited status=$child_status"
exit "$child_status"
