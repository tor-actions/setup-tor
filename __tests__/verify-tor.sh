#!/bin/sh

if [ -z "$1" ]; then
  echo "Must supply tor version argument"
  exit 1
fi

tor_version="$(tor --version)"
echo "Found tor version '$tor_version'"
if [ -z "$(echo $tor_version | grep 'Tor version')" ]; then
  echo "Unexpected version"
  exit 1
fi
