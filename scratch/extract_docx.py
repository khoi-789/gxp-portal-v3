import zipfile
import xml.etree.ElementTree as ET
import os

docx_path = r"d:\Tool\21.Redo_Portal\Module-Import\URS_Import.docx"
output_path = r"C:\Users\qa17\AppData\Roaming\npm\node_modules" # Wait, scratch dir under app data
# Let's put the output file in d:\Tool\21.Redo_Portal\scratch\URS_Import.txt
output_dir = r"d:\Tool\21.Redo_Portal\scratch"
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, "URS_Import.txt")

def extract_text(docx_file):
    try:
        with zipfile.ZipFile(docx_file) as z:
            xml_content = z.read('word/document.xml')
            root = ET.fromstring(xml_content)
            
            # XML namespaces
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            
            text_runs = []
            for para in root.iter():
                if para.tag.endswith('p'):
                    # Paragraph boundary
                    text_runs.append('\n')
                elif para.tag.endswith('t'):
                    if para.text:
                        text_runs.append(para.text)
            
            text = "".join(text_runs)
            # Remove double newlines
            return text
    except Exception as e:
        return f"Error: {str(e)}"

text = extract_text(docx_path)
with open(output_path, "w", encoding="utf-8") as f:
    f.write(text)

print(f"Text extracted successfully and saved to {output_path}")
