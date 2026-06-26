import pandas as pd
import os
import glob
import sys

sys.stdout.reconfigure(encoding='utf-8')

pref_dir = r"D:\Tool\21.Redo_Portal\Preference"

files = [
    "Bien ban noi bo.xlsx",
    "CC.xlsx",
    "LDG.xlsx",
    "Nhan phu.xlsx",
    "BBSC.csv",
    "Theo dõi thay đổi AW.xlsx"
]

print("--- INSPECTING PREFERENCE FILE HEADERS ---")
for f_name in files:
    path = os.path.join(pref_dir, f_name)
    if not os.path.exists(path):
        print(f"File not found: {f_name}")
        continue
    
    print(f"\n=========================================")
    print(f"File: {f_name} (Size: {os.path.getsize(path)} bytes)")
    try:
        if f_name.endswith('.csv'):
            df = pd.read_csv(path, nrows=3, encoding='utf-8')
        else:
            # For Excel files, read first 3 rows of the first sheet
            # If huge, just read headers
            if f_name == "Theo dõi thay đổi AW.xlsx":
                df = pd.read_excel(path, nrows=2)
            else:
                df = pd.read_excel(path, nrows=3)
        
        print("Columns:")
        for i, col in enumerate(df.columns):
            print(f"  {i+1}. {col}")
        
        print("\nSample row:")
        if not df.empty:
            print(df.iloc[0].to_dict())
        else:
            print("  Empty file")
    except Exception as e:
        print(f"Error reading {f_name}: {e}")

print("\n--- INSPECTION COMPLETE ---")
