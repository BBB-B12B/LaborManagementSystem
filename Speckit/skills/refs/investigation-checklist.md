# 🔍 Investigation Checklist for E2E Troubleshooter

ใช้รายการนี้เพื่อตรวจสอบความพร้อมและความถูกต้องในการหาสาเหตุของปัญหา

## 🧱 1. Evidence Verification (หลักฐาน)
- [ ] **Error Message**: ค้นหา Key Error ใน Console/Log (เช่น `TypeError`, `Network Error`, `500 Internal Server Error`)
- [ ] **Screenshot**: ดูว่าหน้าจอค้างที่ Loading state หรือแสดงเนื้อหาผิด (Static vs Dynamic)
- [ ] **Context**: ผู้ใช้กำลังใช้ Browser อะไร หรืออยู่ในเงื่อนไขพิเศษอะไร (เช่น เพิ่ง Login ใหม่)

## 📡 2. Connectivity & Data Flow (การเชื่อมต่อ)
- [ ] **API Endpoint**: ยิงไปที่ Path ที่ถูกต้องไหม (เช่น `/api/v1/wages` vs `/api/wages`)
- [ ] **Payload Check**: Frontend ส่ง Params ครบตามที่ Backend ต้องการไหม (เช็ค `req.body` หรือ `req.query`)
- [ ] **Response Check**: Backend ส่งกลับเป็น JSON หรือ HTML (กรณีพ่น Error 500 บางครั้งเป็น HTML)
- [ ] **Mapping**: ชื่อ Field ใน Response ตรงกับที่ Frontend destruct ออกมาใช้ไหม (เช่น `wage_amount` vs `wageAmount`)

## 🧠 3. Logic & State (ตรรกะ)
- [ ] **Assignment**: ตัวแปรที่ใช้มีการ Initialize ค่าเริ่มต้นไหม (เช่น `useState([])` เพื่อป้องกัน `.map` of undefined)
- [ ] **Condition**: เงื่อนไข `if-else` ครอบคลุมเคสที่ผู้ใช้เจอไหม (เช่น เคสค่าเป็น 0 หรือ Null)
- [ ] **Concurrency**: มีการเรียก API ซ้อนกันจน State ถูกลบหายไหม

## 🔗 4. Missing Link (จุดเชื่อมต่อที่ขาด)
- [ ] **Import/Export**: มีการเอา Component มาใช้แต่ลืม Import หรือ Import ผิดไฟล์ไหม
- [ ] **Event Binding**: ปุ่มกดได้แต่ไม่ได้ใส่ `onClick={...}` หรือใส่แล้วแต่สะกดชื่อฟังก์ชันผิด
- [ ] **Environment**: API Key หรือ base_url ใน `.env` ตั้งค่าถูกต้องหรือไม่
