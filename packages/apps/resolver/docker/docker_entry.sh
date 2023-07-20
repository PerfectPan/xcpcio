#! /bin/bash

CUR_DIR="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"

BOARD_PATH="${CUR_DIR}/dist"
EXPORT_PATH="/app/export"

if [[ -d "${EXPORT_PATH}" ]]; then
    cp -a "${BOARD_PATH}"/* "${EXPORT_PATH}"/
fi

if [[ X"${1}" = X"primary" ]]; then
    cd "${CUR_DIR}/.." || exit 1
    exec npm run start
else
    exec "${@}"
fi
