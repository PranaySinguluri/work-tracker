async function handleUpload() {
  const file = document.getElementById("fileInput").files[0];

  if (!file) return alert("Upload file first");

  if (file.type === "application/pdf") {
    extractPDF(file);
  } else {
    extractImage(file);
  }
}

async function extractImage(file) {
  const result = await Tesseract.recognize(file, 'eng');
  document.getElementById("ocrText").value = result.data.text;
}

async function extractPDF(file) {
  const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(" ");
  }

  document.getElementById("ocrText").value = text;
}
