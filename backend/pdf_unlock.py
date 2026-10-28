"""Memory-only PDF security inspection and authenticated decryption."""
import fitz
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

router = APIRouter(prefix='/api/pdf', tags=['PDF unlock'])
MAX_BYTES = 50 * 1024 * 1024

def read_pdf(file):
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, 'PDF는 50MB 이하만 지원합니다.')
    try:
        doc = fitz.open(stream=data, filetype='pdf')
        if not doc.is_pdf or not doc.page_count:
            doc.close()
            raise ValueError()
        return doc
    except Exception:
        raise HTTPException(400, '올바른 PDF 파일을 선택해주세요.') from None

def protected(doc):
    return bool(doc.needs_pass or doc.metadata.get('encryption'))

@router.post('/security')
def security(file: UploadFile = File(...)):
    with read_pdf(file) as doc:
        return {'protected': protected(doc), 'needs_password': bool(doc.needs_pass)}

@router.post('/unlock')
def unlock(file: UploadFile = File(...), password: str = Form('')):
    with read_pdf(file) as doc:
        if protected(doc):
            needed_password = bool(doc.needs_pass)
            result = doc.authenticate(password)
            # An empty user password can open a restricted PDF; require owner
            # authentication to remove those permissions in that case.
            if not result or (not needed_password and not (result & 4)):
                raise HTTPException(401, '비밀번호가 올바르지 않거나 소유자 비밀번호가 필요합니다.')
        try:
            data = doc.tobytes(encryption=fitz.PDF_ENCRYPT_NONE, garbage=3, deflate=True)
        except Exception:
            raise HTTPException(422, '이 PDF를 저장할 수 없습니다. 파일 상태를 확인해주세요.') from None
    return Response(data, media_type='application/pdf', headers={
        'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="unlocked.pdf"'
    })
