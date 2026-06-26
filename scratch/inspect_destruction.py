import os
import pandas as pd

dest_dir = r"d:\Tool\21.Redo_Portal\Module-Destruction"
files = ["HOLD.xlsx", "Pack.xlsx", "Q 08.05.2026.xlsx"]

out_path = r"d:\Tool\21.Redo_Portal\scratch\destruction_inspection_results.txt"
with open(out_path, "w", encoding="utf-8") as f:
    for filename in files:
        filepath = os.path.join(dest_dir, filename)
        f.write("="*60 + "\n")
        f.write(f"FILE: {filename}\n")
        if not os.path.exists(filepath):
            f.write("File does not exist!\n")
            continue
        try:
            xl = pd.ExcelFile(filepath)
            f.write(f"Sheets: {xl.sheet_names}\n")
            for sheet in xl.sheet_names:
                f.write(f"--- Sheet: {sheet} ---\n")
                df = pd.read_excel(filepath, sheet_name=sheet, nrows=5)
                f.write("First 5 rows:\n")
                f.write(df.to_string() + "\n")
        except Exception as e:
            f.write(f"Error reading Excel: {e}\n")
print("Done writing destruction inspection results.")
