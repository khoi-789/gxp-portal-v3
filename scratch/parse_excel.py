import pandas as pd
import math

excel_path = r"d:\Tool\21.Redo_Portal\Module-Import\NHAP KHAU.xlsx"
out_path = r"d:\Tool\21.Redo_Portal\scratch\parsed_data.txt"

def clean_val(val):
    if pd.isna(val):
        return None
    val_str = str(val).strip()
    if val_str.lower() in ['nan', 'none', 'null', '']:
        return None
    return val_str

with open(out_path, "w", encoding="utf-8") as f:
    try:
        df = pd.read_excel(excel_path)
        f.write(f"Total Rows: {len(df)}\n\n")
        
        # Unique Invoice numbers
        inv_no_col = [c for c in df.columns if 'inv' in c.lower()][0]
        unique_invs = df[inv_no_col].dropna().unique()
        f.write(f"Unique Invoices ({len(unique_invs)}):\n")
        f.write(", ".join(map(str, unique_invs[:20])) + "...\n\n")
        
        # Let's inspect each row's data
        f.write("Row-by-Row Analysis:\n")
        for i, row in df.iterrows():
            stt = clean_val(row.get('STT'))
            inv = clean_val(row.get('INV No.'))
            hang = clean_val(row.get('Hãng'))
            sp = clean_val(row.get('Sản phẩm '))
            lh = clean_val(row.get('Nhập Kho \nLong Hậu'))
            hn = clean_val(row.get('Nhập Kho \nHà Nội'))
            coa = clean_val(row.get('COA'))
            nhan = clean_val(row.get('Nhãn phụ'))
            vande = clean_val(row.get('Vấn đề'))
            tiendo = clean_val(row.get('Tiến độ'))
            ghichu = clean_val(row.get('Ghi chú'))
            link_inv = clean_val(row.get('Link INV'))
            link_hang = clean_val(row.get('Link hãng'))
            logger = clean_val(row.get('DATA LOGGER'))
            qty = clean_val(row.get('Số lượng'))
            out_range = clean_val(row.get('DATA out of range'))
            
            f.write(f"Row {i}:\n")
            f.write(f"  STT (Date): {stt}\n")
            f.write(f"  INV No: {inv}\n")
            f.write(f"  Hãng: {hang}\n")
            f.write(f"  Sản phẩm: {sp}\n")
            f.write(f"  Nhập Long Hậu: {lh}\n")
            f.write(f"  Nhập Hà Nội: {hn}\n")
            f.write(f"  COA: {coa}\n")
            f.write(f"  Nhãn phụ: {nhan}\n")
            f.write(f"  Tiến độ: {tiendo}\n")
            f.write(f"  Logger: {logger} (Qty: {qty}, Out of range: {out_range})\n")
            f.write(f"  Vấn đề: {vande}\n")
            f.write(f"  Ghi chú: {ghichu}\n")
            f.write(f"  Link INV: {link_inv}\n")
            f.write("-" * 40 + "\n")
            
        print("Success! Data parsed to", out_path)
    except Exception as e:
        print("Error:", str(e))
        f.write(f"Error: {str(e)}\n")
