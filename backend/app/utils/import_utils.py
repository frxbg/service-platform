import csv
import io
import json
from typing import List, Tuple

from fastapi import HTTPException, UploadFile, status
import openpyxl


def _build_columns(width: int) -> List[str]:
    return [f"column_{idx + 1}" for idx in range(width)]


def _row_to_dict(headers: List[str], row: list | tuple) -> dict:
    return {
        headers[idx]: (row[idx] if idx < len(row) and row[idx] is not None else "")
        for idx in range(len(headers))
    }


def parse_selected_row_indexes(selected_rows: str, available_rows: int) -> set[int]:
    try:
        payload = json.loads(selected_rows)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid selected rows payload",
        ) from exc

    if not isinstance(payload, list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected rows payload must be a list",
        )

    indexes: set[int] = set()
    for item in payload:
        if isinstance(item, bool):
            continue
        if isinstance(item, int):
            index = item
        elif isinstance(item, str) and item.strip().isdigit():
            index = int(item.strip())
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected rows payload contains invalid values",
            )

        if 0 <= index < available_rows:
            indexes.add(index)

    if not indexes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No rows selected for import",
        )

    return indexes


def read_tabular_upload(
    file: UploadFile,
    max_rows: int = 5000,
    has_header: bool = True,
) -> Tuple[List[str], list[dict]]:
    """
    Read CSV or Excel (xlsx/xlsm) upload and return (columns, rows as dicts).
    """
    filename = file.filename or ""
    ext = filename.lower().rsplit(".", 1)[-1]

    content = file.file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file",
        )

    if ext == "csv":
        text = content.decode("utf-8-sig")
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CSV contains no rows",
            )

        if has_header:
            headers = [h if h else f"column_{idx+1}" for idx, h in enumerate(rows[0])]
            data_rows = rows[1 : max_rows + 1]
        else:
            width = max(len(row) for row in rows)
            headers = _build_columns(width)
            data_rows = rows[:max_rows]

        dict_rows = [_row_to_dict(headers, row) for row in data_rows]
    elif ext in {"xlsx", "xlsm"}:
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.active
        data = list(ws.iter_rows(values_only=True))
        if not data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Excel file contains no rows",
            )

        if has_header:
            headers = [
                (str(h).strip() if h is not None and str(h).strip() != "" else f"column_{idx+1}")
                for idx, h in enumerate(data[0])
            ]
            data_rows = data[1 : max_rows + 1]
        else:
            width = max(len(row) for row in data)
            headers = _build_columns(width)
            data_rows = data[:max_rows]

        dict_rows = []
        for row in data_rows:
            dict_rows.append(_row_to_dict(headers, row))
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Use CSV or Excel (.xlsx)",
        )

    columns = [col for col in headers if col]
    preview_rows = dict_rows[: max_rows]
    return columns, preview_rows
