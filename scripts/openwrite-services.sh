#!/bin/zsh
set -u

uid="$(id -u)"
domain="gui/$uid"
agent_dir="/Users/openclaw/Library/LaunchAgents"
log_dir="/Users/openclaw/Library/Logs/OpenWrite"
labels=("com.openwrite.backend.dev" "com.openwrite.frontend.dev")

usage() {
  echo "Usage: $0 {start|stop|restart|status|logs}"
}

plist_for_label() {
  echo "$agent_dir/$1.plist"
}

start_service() {
  local label="$1"
  local plist
  plist="$(plist_for_label "$label")"
  if launchctl print "$domain/$label" >/dev/null 2>&1; then
    launchctl kickstart -k "$domain/$label"
    return
  fi
  if ! launchctl bootstrap "$domain" "$plist"; then
    sleep 1
    if launchctl print "$domain/$label" >/dev/null 2>&1; then
      launchctl kickstart -k "$domain/$label"
      return
    fi
    return 1
  fi
}

stop_service() {
  local label="$1"
  if launchctl print "$domain/$label" >/dev/null 2>&1; then
    launchctl bootout "$domain/$label" || launchctl bootout "$domain" "$(plist_for_label "$label")" || true
  fi
}

mkdir -p "$agent_dir" "$log_dir"

case "${1:-}" in
  start)
    for label in "${labels[@]}"; do
      start_service "$label"
    done
    ;;
  stop)
    for label in "${labels[@]}"; do
      stop_service "$label"
    done
    ;;
  restart)
    for label in "${labels[@]}"; do
      stop_service "$label"
    done
    sleep 1
    for label in "${labels[@]}"; do
      start_service "$label"
    done
    ;;
  status)
    for label in "${labels[@]}"; do
      echo "== $label =="
      launchctl print "$domain/$label" 2>/dev/null || echo "not loaded"
    done
    ;;
  logs)
    tail -n 120 -f "$log_dir/backend.out.log" "$log_dir/backend.err.log" "$log_dir/frontend.out.log" "$log_dir/frontend.err.log"
    ;;
  *)
    usage
    exit 64
    ;;
esac
