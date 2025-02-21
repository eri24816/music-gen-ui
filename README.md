## install

```bash
pip install -r back/requirements.txt
cd front
npm install
```

## run

```bash
uvicorn back.app.main:app --reload
cd front
npm run dev
```
