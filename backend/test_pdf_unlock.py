import unittest
import fitz
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pdf_unlock import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)

def fixture(user='reader', encrypted=True):
    with fitz.open() as doc:
        doc.new_page().insert_text((72,72), 'Original searchable text 123')
        doc.set_metadata({'title':'Preserved title'})
        doc.set_toc([[1,'Chapter',1]])
        return doc.tobytes(encryption=fitz.PDF_ENCRYPT_AES_256 if encrypted else fitz.PDF_ENCRYPT_NONE,
            user_pw=user, owner_pw='owner', permissions=fitz.PDF_PERM_PRINT)

class UnlockTests(unittest.TestCase):
    def post(self, endpoint, data, password=''):
        return client.post('/api/pdf/'+endpoint, files={'file':('sample.pdf',data,'application/pdf')}, data={'password':password})
    def test_password_and_preservation(self):
        data = fixture()
        self.assertTrue(self.post('security',data).json()['protected'])
        self.assertEqual(self.post('unlock',data,'wrong').status_code,401)
        for password in ['reader','owner']:
            result = self.post('unlock',data,password)
            self.assertEqual(result.status_code,200)
            self.assertEqual(result.headers['cache-control'],'no-store')
            with fitz.open(stream=result.content,filetype='pdf') as doc:
                self.assertFalse(doc.needs_pass)
                self.assertFalse(doc.metadata['encryption'])
                self.assertIn('123',doc[0].get_text())
                self.assertEqual(doc.metadata['title'],'Preserved title')
                self.assertEqual(doc.get_toc(),[[1,'Chapter',1]])
    def test_owner_required_for_restrictions(self):
        data = fixture(user='')
        self.assertTrue(self.post('security',data).json()['protected'])
        self.assertEqual(self.post('unlock',data,'').status_code,401)
        self.assertEqual(self.post('unlock',data,'owner').status_code,200)
    def test_plain_and_invalid(self):
        self.assertFalse(self.post('security',fixture(encrypted=False)).json()['protected'])
        self.assertEqual(self.post('security',b'not pdf').status_code,400)
    def test_size_limit(self):
        import pdf_unlock
        old = pdf_unlock.MAX_BYTES
        try:
            pdf_unlock.MAX_BYTES = 16
            self.assertEqual(self.post('unlock',b'x'*17).status_code,413)
        finally:
            pdf_unlock.MAX_BYTES = old

if __name__ == '__main__': unittest.main()
