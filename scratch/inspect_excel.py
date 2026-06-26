import pandas as pd
import openpyxl
import sys

excel_path = r"d:\Tool\21.Redo_Portal\Module-Import\NHAP KHAU.xlsx"
out_path = r"d:\Tool\21.Redo_Portal\scratch\excel_info.txt"

with open(out_path, "w", encoding="utf-8") as f:
    try:
        # Print sheet names
        wb = openpyxl.load_workbook(excel_path, read_only=True)
        f.write(f"Sheets: {wb.sheetnames}\n")
        
        # Read first sheet using pandas
        df = pd.read_excel(excel_path)
        f.write("\nColumns:\n")
        f.write(", ".join(df.columns.tolist()) + "\n")
        
        f.write("\nFirst 10 rows:\n")
        f.write(df.head(10).to_string() + "\n")
        print("Success! Saved to", out_path)
    except Exception as e:
        f.write(f"Error: {str(e)}\n")
        print("Error written to file")
