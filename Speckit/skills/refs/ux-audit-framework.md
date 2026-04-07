# 🎨 UX Audit Framework (Benium Influence)

แนวคิดการตรวจสอบประสบการณ์ผู้ใช้ (UX Review) สำหรับระบบงานจริง เพื่อให้ระบบไม่ได้แค่ทำงานได้แต่ต้อง "ใช้งานได้"

## 🚏 1. Visibility of System Status (สถานะระบบ)
- [ ] **Loading**: มี Spinner หรือ Skeleton เมื่อเตรียมข้อมูลไหม
- [ ] **Empty State**: ข้อมูลเป็น 0 หรือ Null แล้วแสดงผลอย่างไร (ดีกว่าการปล่อยให้ขาวว่าง)
- [ ] **Success/Error**: มี Toast หรือ Notification เมื่อบันทึกสำเร็จไหม

## 🚦 2. Control & Freedom (อิสระในการใช้งาน)
- [ ] **Cancel**: มีปุ่ม "ยกเลิก" เมื่อกดเลือกผิดไหม
- [ ] **Confirmation**: มีปุ่ม "ยืนยัน" ก่อนจะลบข้อมูลสำคัญไหม
- [ ] **Hierarchy**: ปุ่มหลัก (Action) ต้องเด่นกว่าปุ่มรอง (Cancel)

## 🔠 3. Consistency & Standards (ความสม่ำเสมอ)
- [ ] **Naming**: ใช้ศัพท์เดียวกันทั้งหน้าจอ (เช่น "Save" vs "บันทึก" ต้องเหมือนกันทุกจุด)
- [ ] **Colors**: สีแดงสำหรับ Danger/Error, สีเขียวสำหรับ Success
- [ ] **Alignment**: ระยะห่าง (Padding/Margin) สม่ำเสมอทุกล็อก

## 🧠 4. Error Prevention & Recovery (การจัดการข้อผิดพลาด)
- [ ] **Validation**: ห้ามกด Submit ถ้าข้อมูลยังไม่ครบ (Disable button จนกว่าจะ Validate ผ่าน)
- [ ] **Actionable Error**: ข้อความ Error ต้องบอกว่า "ไปแก้ตรงไหน" (ไม่ใช่แค่ `Something went wrong`)

## 🛣️ 5. Interaction Flow (ความลื่นไหล)
- [ ] **Steps**: ขั้นตอนการทำงานไม่ซับซ้อนเกินไป (ลดจำนวนการคลิกที่ไม่จำเป็น)
- [ ] **Focus**: เมื่อกดปุ่มแล้วหน้าจอควร Focus ที่ข้อมูลที่เกี่ยวข้องทันที
