import os
import pandas as pd
import sys

# Set standard output encoding to utf-8 if possible
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

pref_dir = r"d:\Tool\21.Redo_Portal\Preference"
files = [
    "BBSC.csv",
    "Bien ban noi bo.xlsx",
    "CC.xlsx",
    "LDG.xlsx",
    "NHAP KHAU.xlsx",
    "Nhan phu.xlsx",
    "Theo dõi thay đổi AW.xlsx"
]

out_path = r"d:\Tool\21.Redo_Portal\scratch\inspection_results.txt"
with open(out_path, "w", encoding="utf-8") as f:
    for filename in files:
        filepath = os.path.join(pref_dir, filename)
        f.write("="*60 + "\n")
        f.write(f"FILE: {filename}\n")
        if not os.path.exists(filepath):
            f.write("File does not exist!\n")
            continue
        
        if filename.endswith(".csv"):
            try:
                # Try reading with utf-8 or utf-8-sig or latin1 if it fails
                try:
                    df = pd.read_csv(filepath, nrows=5, encoding="utf-8")
                except UnicodeDecodeError:
                    df = pd.read_csv(filepath, nrows=5, encoding="utf-8-sig")
                f.write("Columns:\n")
                f.write(str(df.columns.tolist()) + "\n")
                f.write("\nFirst row:\n")
                f.write(str(df.head(1).to_dict(orient="records")) + "\n")
            except Exception as e:
                f.write(f"Error reading CSV: {e}\n")
        else:
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
    print("Done writing to scratch/inspection_results.txt")
