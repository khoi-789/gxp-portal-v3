import pandas as pd
import openpyxl
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

pref_dir = r"D:\Tool\21.Redo_Portal\Preference"

files = [
    "Bien ban noi bo.xlsx",
    "CC.xlsx",
    "Nhan phu.xlsx",
    "Theo dõi thay đổi AW.xlsx"
]

print("--- DETAILED EXCEL INSPECTION ---")
for f_name in files:
    path = os.path.join(pref_dir, f_name)
    if not os.path.exists(path):
        continue
    
    print(f"\n=========================================")
    print(f"File: {f_name}")
    try:
        # Load workbook using openpyxl to get sheet names
        wb = openpyxl.load_workbook(path, read_only=True)
        print("Sheets:", wb.sheetnames)
        
        # Read the first sheet's first 15 rows with no header to see the structure
        df = pd.read_excel(path, sheet_name=0, header=None, nrows=15)
        print("First 15 rows (raw):")
        for idx, row in df.iterrows():
            # filter out completely nan values to make it cleaner to read
            row_vals = [val for val in row.values if pd.notna(val)]
            if row_vals:
                print(f"  Row {idx}: {row_vals[:10]}")
    except Exception as e:
        print(f"Error: {e}")

print("\n--- DETAILED INSPECTION COMPLETE ---")
