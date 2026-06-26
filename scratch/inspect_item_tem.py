import pandas as pd
import sys

# Set output encoding to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

file_path = r"D:\Tool\21.Redo_Portal\Module-Import\ItemTem.xlsx"
df = pd.read_excel(file_path)

print("Columns in file:")
print([str(c) for c in df.columns])
print("\nShape:")
print(df.shape)
print("\nFirst 10 rows:")
for idx, row in df.head(10).iterrows():
    print(f"Row {idx}: {dict(row)}")
