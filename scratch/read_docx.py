import zipfile
import xml.etree.ElementTree as ET
import os
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

docx_path = r"D:\Tool\21.Redo_Portal\Preference\1.4.2 Description (update).docx"
if not os.path.exists(docx_path):
    print("File not found")
    sys.exit(1)

try:
    with zipfile.ZipFile(docx_path) as docx:
        xml_content = docx.read('word/document.xml')
        root = ET.fromstring(xml_content)
        
        # Find all text elements
        texts = []
        for elem in root.iter():
            if elem.tag.endswith('t'): # matches w:t
                if elem.text:
                    texts.append(elem.text)
            elif elem.tag.endswith('p') or elem.tag.endswith('br') or elem.tag.endswith('cr'): # paragraph or line break
                texts.append('\n')
        
        full_text = "".join(texts)
        
        # Clean double newlines
        while '\n\n\n' in full_text:
            full_text = full_text.replace('\n\n\n', '\n\n')
            
        print("--- EXTRACTED DOCX PREVIEW (5000 chars) ---")
        print(full_text[:5000])
        print("------------------------------------------")
        
        # Save to text file
        output_txt = r"D:\Tool\21.Redo_Portal\Preference\1.4.2_Description_extracted.txt"
        with open(output_txt, "w", encoding="utf-8") as out:
            out.write(full_text)
        print(f"\nSaved full text to {output_txt}")
except Exception as e:
    print("Error:", str(e))
