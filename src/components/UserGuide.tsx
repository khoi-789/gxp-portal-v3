'use client';

import React from 'react';
import { Card, Tabs, Typography, Tag, Timeline, Alert, Row, Col, Divider } from 'antd';
import {
  BookOpen,
  Database,
  Truck,
  Shield,
  Lock,
  Unlock,
  AlertTriangle,
  HelpCircle,
  Users,
  Settings,
  Info
} from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export default function UserGuide() {
  const sections = [
    {
      key: 'general',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
          <BookOpen size={16} color="#0d9488" />
          Tổng quan hệ thống
        </span>
      ),
      children: (
        <div style={{ padding: '8px 4px' }}>
          <Title level={4} style={{ color: '#0f766e', marginTop: 0 }}>
            Hệ thống Quản lý Chất lượng Dược phẩm (GxP Portal)
          </Title>
          <Paragraph style={{ fontSize: 14, lineHeight: '1.7', color: '#475569' }}>
            Portal được thiết kế phục vụ công tác theo dõi chất lượng hàng hóa nhập khẩu/nhập kho (COA, nhãn phụ, theo dõi nhiệt độ data logger và thực tế nhập kho). Hệ thống tích hợp cơ chế quản lý dữ liệu gốc (Master Data) và phân quyền chặt chẽ (RBAC) giữa các nhóm QA chuyên trách để đảm bảo quy trình kiểm soát chất lượng GxP luôn tuân thủ và chính xác.
          </Paragraph>

          <Alert
            message={<Text style={{ fontWeight: 700, color: '#0f766e' }}>Môi trường demo (Pilot Mode)</Text>}
            description="Thanh chuyển đổi vai trò ở đầu trang chủ cho phép bạn nhanh chóng đóng vai trò Admin/Staff hoặc chuyển đổi giả lập giữa QA Nhập khẩu & QA Kho tại màn hình IMP để kiểm thử trực quan các logic chặn và khóa form hồ sơ."
            type="info"
            showIcon
            icon={<Info size={18} color="#0d9488" />}
            style={{ borderRadius: 12, background: '#f0fdfa', border: '1px solid #ccfbf1' }}
          />

          <Divider style={{ margin: '24px 0 16px' }} />

          <Title level={5} style={{ color: '#1e293b', marginBottom: 12 }}>
            <Users size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} /> Các vai trò trong hệ thống
          </Title>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card
                title={<Tag color="gold">ADMIN</Tag>}
                bordered={false}
                style={{
                  background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                  borderRadius: 12,
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                }}
              >
                <Text style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#78350f' }}>
                  Quản trị viên hệ thống
                </Text>
                <ul style={{ paddingLeft: 18, color: '#92400e', fontSize: 13, lineHeight: '1.6' }}>
                  <li>Có toàn quyền quản lý Master Data.</li>
                  <li>Phân quyền công cụ, kiểm soát danh mục đối tác, nhà cung cấp và tem nhãn phụ.</li>
                </ul>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card
                title={<Tag color="blue">QA Nhập khẩu (QA_NHAP_KHAU)</Tag>}
                bordered={false}
                style={{
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  borderRadius: 12,
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                }}
              >
                <Text style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#1e3a8a' }}>
                  Nhân sự quản lý chứng từ nhập khẩu
                </Text>
                <ul style={{ paddingLeft: 18, color: '#1e40af', fontSize: 13, lineHeight: '1.6' }}>
                  <li>Tạo mới, lập kế hoạch kiểm nhập Invoice.</li>
                  <li>Duyệt chứng từ COA, tem nhãn phụ của nhà cung cấp.</li>
                  <li>Có quyền mở lại hồ sơ khi đã khóa "Hoàn tất".</li>
                </ul>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card
                title={<Tag color="purple">QA Kho (QA_KHO)</Tag>}
                bordered={false}
                style={{
                  background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
                  borderRadius: 12,
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                }}
              >
                <Text style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#581c87' }}>
                  Nhân sự quản lý kiểm nhập thực tế
                </Text>
                <ul style={{ paddingLeft: 18, color: '#6b21a8', fontSize: 13, lineHeight: '1.6' }}>
                  <li>Theo dõi nhiệt độ trong suốt hành trình (Data Logger).</li>
                  <li>Cập nhật thông tin thực tế nhập kho (kho đích, ngày nhập kho).</li>
                  <li>Không có quyền tự ý mở khóa hồ sơ "Hoàn tất".</li>
                </ul>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card
                title={<Tag color="magenta">VIEWER</Tag>}
                bordered={false}
                style={{
                  background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
                  borderRadius: 12,
                  height: '100%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                }}
              >
                <Text style={{ display: 'block', fontWeight: 600, marginBottom: 8, color: '#9d174d' }}>
                  Người xem thông tin
                </Text>
                <ul style={{ paddingLeft: 18, color: '#9d174d', fontSize: 13, lineHeight: '1.6' }}>
                  <li>Xem và lọc danh sách dữ liệu trên tất cả các phân hệ và Master Data.</li>
                  <li><strong>Không</strong> được phép thêm mới, chỉnh sửa hoặc xóa bất kỳ thông tin nào.</li>
                  <li><strong>Không</strong> được phép thao tác nhập/xuất file (Import/Export).</li>
                </ul>
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: 'master-data',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
          <Database size={16} color="#0d9488" />
          Master Data
        </span>
      ),
      children: (
        <div style={{ padding: '8px 4px' }}>
          <Title level={4} style={{ color: '#0f766e', marginTop: 0 }}>
            Quản lý Dữ liệu Gốc (Master Data)
          </Title>
          <Paragraph style={{ fontSize: 14, lineHeight: '1.7', color: '#475569' }}>
            Master Data cung cấp các danh mục dữ liệu dùng chung thống nhất cho toàn bộ hệ thống. Chỉ người dùng có vai trò <Text style={{ color: '#b45309', fontWeight: 700 }}>Admin</Text> mới nhìn thấy và truy cập được menu cấu hình này.
          </Paragraph>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} md={8}>
              <Card
                title={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BookOpen size={15} color="#0d9488"/> Danh mục sản phẩm</span>}
                bordered
                style={{ borderRadius: 12 }}
              >
                <Paragraph style={{ fontSize: 13, color: '#64748b' }}>
                  Quản lý thông tin tất cả sản phẩm lưu hành trong hệ thống.
                </Paragraph>
                <Alert
                  message="Mã SP có thể trống"
                  description="Khi phát sinh sản phẩm mới chưa có mã chính thức, hệ thống cho phép tạo sản phẩm không cần nhập Mã danh mục (Item Code)."
                  type="warning"
                  showIcon
                  style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8 }}
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card
                title={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Truck size={15} color="#0d9488"/> Danh mục nhà cung cấp</span>}
                bordered
                style={{ borderRadius: 12 }}
              >
                <Paragraph style={{ fontSize: 13, color: '#64748b' }}>
                  Quản lý mã nhà cung cấp và tên hãng hàng hóa.
                </Paragraph>
                <Alert
                  message="Lưu mã - Hiện tên"
                  description="Để trực quan, danh sách luôn hiển thị tên NCC đầy đủ (DR REDDYS, TORRENT) nhưng DB vẫn lưu trữ đúng mã code nguyên bản của đối tác."
                  type="success"
                  showIcon
                  style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8 }}
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card
                title={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Settings size={15} color="#0d9488"/> Liên kết sản phẩm - Tem</span>}
                bordered
                style={{ borderRadius: 12 }}
              >
                <Paragraph style={{ fontSize: 13, color: '#64748b' }}>
                  Định nghĩa mỗi sản phẩm tương ứng với những loại tem nhãn phụ/nhãn chỉ thị nào khi nhập kho.
                </Paragraph>
                <Alert
                  message="Cấu hình tem mặc định"
                  description="Khi lập Invoice, sản phẩm sẽ tự động nhận danh sách tem yêu cầu từ liên kết này làm mẫu ban đầu."
                  type="info"
                  showIcon
                  style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8 }}
                />
              </Card>
            </Col>
          </Row>

          <Divider style={{ margin: '24px 0 16px' }} />

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card
                title={<span style={{ color: '#0d9488', fontWeight: 600 }}>Tải Template & Nhập dữ liệu lớn (Import)</span>}
                bordered
                bodyStyle={{ padding: 16 }}
                style={{ height: '100%', borderColor: '#ccfbf1' }}
              >
                <ul style={{ paddingLeft: 18, color: '#475569', fontSize: 13, lineHeight: '1.8' }}>
                  <li><strong>Tải Template chuẩn</strong>: Admin sử dụng nút <strong>"Tải template"</strong> để nhận file Excel mẫu chuẩn được định dạng sẵn cấu trúc cột.</li>
                  <li><strong>Nhập Excel hàng loạt</strong>: Admin chọn file Excel đã điền dữ liệu và nhấn nút <strong>"Nhập Excel"</strong> để hệ thống tự động xử lý, kiểm tra dữ liệu và thêm/cập nhật hàng loạt vào database.</li>
                </ul>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card
                title={<span style={{ color: '#0891b2', fontWeight: 600 }}>Xuất dữ liệu & Quy tắc xuất theo bộ lọc (Export)</span>}
                bordered
                bodyStyle={{ padding: 16 }}
                style={{ height: '100%', borderColor: '#c5f2f7' }}
              >
                <ul style={{ paddingLeft: 18, color: '#475569', fontSize: 13, lineHeight: '1.8' }}>
                  <li><strong>Xuất dữ liệu ra Excel</strong>: Xuất thông tin danh mục nhanh chóng ra định dạng file `.xlsx` thông qua nút <strong>"Xuất Excel"</strong>.</li>
                  <li><strong>Tự động xuất theo bộ lọc</strong>: Khi bấm xuất Excel, hệ thống sẽ tự động quét bộ lọc hiện hành (Tìm kiếm tổng và lọc đầu cột):
                    <ul style={{ paddingLeft: 12, marginTop: 4, listStyleType: 'circle' }}>
                      <li>Nếu <i>đang có bộ lọc hoạt động</i>: Chỉ xuất những dữ liệu khớp với bộ lọc trên màn hình.</li>
                      <li>Nếu <i>không dùng bộ lọc</i>: Tự động xuất toàn bộ danh sách.</li>
                    </ul>
                  </li>
                  <li><i>* Quy tắc xuất theo bộ lọc này được áp dụng thống nhất trên tất cả các bảng dữ liệu Master Data và các Module nghiệp vụ hiện tại lẫn sau này.</i></li>
                </ul>
              </Card>
            </Col>
          </Row>

          <Divider style={{ margin: '24px 0 16px' }} />

          <Title level={5} style={{ color: '#1e293b' }}>
            <Shield size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} /> Đồng bộ hóa dữ liệu thời gian thực
          </Title>
          <Paragraph style={{ fontSize: 13, color: '#475569' }}>
            Tất cả các thay đổi trong Master Data (như đổi tên nhà cung cấp, thêm liên kết nhãn phụ mới) sẽ được đồng bộ trực tiếp lên hệ thống lưu trữ đám mây. Khi người dùng mở module kiểm nhập IMP, danh sách gợi ý và dropdown lựa chọn luôn tự động tải dữ liệu thực tế mới nhất.
          </Paragraph>
        </div>
      ),
    },
    {
      key: 'imp',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
          <Truck size={16} color="#0d9488" />
          IMP (Nhập khẩu)
        </span>
      ),
      children: (
        <div style={{ padding: '8px 4px' }}>
          <Title level={4} style={{ color: '#0f766e', marginTop: 0 }}>
            Quy trình & Nghiệp vụ Kiểm nhập Lô hàng Nhập khẩu (IMP)
          </Title>
          <Paragraph style={{ fontSize: 14, lineHeight: '1.7', color: '#475569' }}>
            IMP là phân hệ theo dõi các lô hàng nhập khẩu từ khi khởi tạo, kiểm duyệt hồ sơ cho tới khi nhập kho thực tế và lưu trữ hồ sơ. Giao diện tích hợp hệ thống kiểm tra logic chặn và khóa form hồ sơ tự động để đảm bảo tính GxP.
          </Paragraph>

          <Title level={5} style={{ color: '#1e293b', marginTop: 20 }}>
            1. Các trạng thái của Tiến độ hồ sơ
          </Title>
          <Timeline
            mode="left"
            items={[
              {
                color: 'blue',
                children: (
                  <div>
                    <strong style={{ color: '#1d4ed8' }}>Khởi tạo (Created)</strong>
                    <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                      Invoice mới được tạo bởi QA Nhập khẩu. Thông tin ban đầu bắt đầu được điền.
                    </p>
                  </div>
                ),
              },
              {
                color: 'orange',
                children: (
                  <div>
                    <strong style={{ color: '#ea580c' }}>Đang xử lý (Checking / Pending / Issue)</strong>
                    <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                      Hồ sơ đang trong quá trình bổ sung tài liệu COA, in ấn dán nhãn phụ hoặc kiểm tra biểu đồ logger nếu có cảnh báo nhiệt độ.
                    </p>
                  </div>
                ),
              },
              {
                color: 'green',
                children: (
                  <div>
                    <strong style={{ color: '#16a34a' }}>Hoàn tất (Closed)</strong>
                    <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                      Hồ sơ hoàn tất kiểm nhập và được lưu trữ vĩnh viễn. Kích hoạt logic khóa form tự động.
                    </p>
                  </div>
                ),
              },
            ]}
          />

          <Divider style={{ margin: '24px 0 16px' }} />

          <Title level={5} style={{ color: '#b91c1c' }}>
            <AlertTriangle size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} /> 2. Quy tắc chặn nghiêm ngặt (Validation Rules) khi "Hoàn tất"
          </Title>
          <Paragraph style={{ fontSize: 13, color: '#475569' }}>
            Khi người dùng chọn chuyển trạng thái Tiến độ sang <Text strong style={{ color: '#16a34a' }}>"Hoàn tất"</Text>, hệ thống sẽ thực hiện xác thực bắt buộc. Nếu thiếu bất kỳ thông tin nào sau đây, thao tác Lưu sẽ bị từ chối:
          </Paragraph>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card
                title={<span style={{ color: '#b91c1c', fontWeight: 600 }}>Thông tin chung bắt buộc</span>}
                bordered
                bodyStyle={{ padding: 16 }}
                style={{ height: '100%', borderColor: '#fca5a5' }}
              >
                <ul style={{ paddingLeft: 18, color: '#475569', fontSize: 13, lineHeight: '1.8' }}>
                  <li><strong>Số Invoice</strong> (Không được trống)</li>
                  <li><strong>Ngày nhận mail</strong> (Không được rỗng hoặc ghi nhận mặc định là "Chưa")</li>
                  <li><strong>Nhà cung cấp / Hãng</strong> (Phải chọn từ Master Data)</li>
                  <li><strong>Kho đích nhập thực tế</strong> (Không được rỗng)</li>
                  <li><strong>Ngày nhập kho thực tế</strong> (Phải nhập ngày hợp lệ, không được để trống hoặc ghi nhận là "Chưa")</li>
                </ul>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card
                title={<span style={{ color: '#d97706', fontWeight: 600 }}>Thông tin theo từng sản phẩm</span>}
                bordered
                bodyStyle={{ padding: 16 }}
                style={{ height: '100%', borderColor: '#fde047' }}
              >
                <ul style={{ paddingLeft: 18, color: '#475569', fontSize: 13, lineHeight: '1.8' }}>
                  <li><strong>Trạng thái COA</strong>: Phải có trạng thái COA được cập nhật đầy đủ.</li>
                  <li><strong>Nút gạt Data Logger (Có/Không)</strong>:
                    <ul style={{ paddingLeft: 12, marginTop: 4, listStyleType: 'circle' }}>
                      <li>Nếu <strong>"Có"</strong>: Bắt buộc điền <i>Loại logger</i> và <i>Số lượng</i>.</li>
                      <li>Nếu <strong>"Không"</strong>: Cho phép để trống thông tin logger.</li>
                    </ul>
                  </li>
                  <li><strong>Nút gạt Phát sinh vấn đề (Có/Không)</strong>:
                    <ul style={{ paddingLeft: 12, marginTop: 4, listStyleType: 'circle' }}>
                      <li>Nếu <strong>"Có"</strong>: Bắt buộc điền <i>Vấn đề phát sinh</i> và <i>Hướng xử lý</i>.</li>
                      <li>Nếu <strong>"Không"</strong>: Cho phép để trống.</li>
                    </ul>
                  </li>
                  <li><i>* Lưu ý: item_code (Mã SP) được phép để trống trong danh mục sản phẩm của Invoice nếu là SP nhập thủ công.</i></li>
                </ul>
              </Card>
            </Col>
          </Row>

          <Divider style={{ margin: '24px 0 16px' }} />

          <Title level={5} style={{ color: '#1e293b' }}>
            <Lock size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} /> 3. Logic khóa form (isClosed) & Khôi phục chỉnh sửa
          </Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Alert
              message={<span style={{ fontWeight: 700 }}>Nguyên tắc Khóa Form</span>}
              description="Sau khi lưu thành công trạng thái Tiến độ là 'Hoàn tất', hồ sơ sẽ đóng. Tất cả các ô nhập liệu, nút gạt, lịch chọn ngày, bảng sản phẩm và các nút thao tác xóa/chỉnh sửa trong form Drawer sẽ bị vô hiệu hóa (disabled) đối với cả QA Nhập khẩu & QA Kho."
              type="error"
              showIcon
              icon={<Lock size={18} color="#dc2626" />}
              style={{ borderRadius: 12 }}
            />
            <Alert
              message={<span style={{ fontWeight: 700 }}>Đặc quyền mở khóa của QA Nhập khẩu</span>}
              description={
                <span>
                  Chỉ riêng tài khoản giả lập vai trò <strong>QA Nhập khẩu (QA_NHAP_KHAU)</strong> mới được quyền bấm vào ô lựa chọn Tiến độ của hồ sơ đang khóa để chọn chuyển sang trạng thái khác (ví dụ: 'Đang xử lý'). Khi đó form sẽ được tự động mở khóa (isClosed = false) và cho phép cả hai phòng ban chỉnh sửa lại bình thường. <strong>QA Kho (QA_KHO)</strong> không có đặc quyền này.
                </span>
              }
              type="success"
              showIcon
              icon={<Unlock size={18} color="#16a34a" />}
              style={{ borderRadius: 12 }}
            />
          </div>

          <Divider style={{ margin: '24px 0 16px' }} />

          <Title level={5} style={{ color: '#0d9488' }}>
            <HelpCircle size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} /> 4. Hướng dẫn sử dụng Bộ lọc cảnh báo nhanh (Dashboard Filter Cards)
          </Title>
          <Paragraph style={{ fontSize: 13, color: '#475569' }}>
            Thanh thống kê đầu trang IMP hiển thị 5 thẻ chỉ số. Ba thẻ ở giữa đóng vai trò là các bộ lọc nhanh (toggles):
          </Paragraph>
          <ul style={{ paddingLeft: 18, color: '#475569', fontSize: 13, lineHeight: '1.8' }}>
            <li><strong>Thiếu mã SP</strong> (Màu tím): Lọc danh sách chỉ hiển thị các Invoice chứa sản phẩm bị thiếu mã danh mục (item_code = null/rỗng).</li>
            <li><strong>Thiếu COA</strong> (Màu đỏ): Lọc hiển thị các Invoice có bất kỳ sản phẩm nào chưa được cập nhật COA Đạt.</li>
            <li><strong>Cảnh báo nhiệt</strong> (Màu cam): Lọc hiển thị những Invoice bị lệch nhiệt độ bảo quản trong hành trình vận chuyển.</li>
          </ul>
          <Paragraph style={{ fontSize: 13, color: '#475569', fontStyle: 'italic', marginTop: 8 }}>
            * Click lần 1 vào thẻ để kích hoạt lọc (thẻ sẽ chuyển sang màu đậm hơn kèm tag "Đang lọc"), click lần 2 để tắt lọc và hiển thị đầy đủ danh sách. Bạn có thể bật đồng thời nhiều thẻ để lọc kết hợp.
          </Paragraph>

          <Divider style={{ margin: '24px 0 16px' }} />

          <Title level={5} style={{ color: '#0f766e' }}>
            <Settings size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} /> 5. Các tính năng tự động hóa thông minh (Smart Automation)
          </Title>
          <Paragraph style={{ fontSize: 13, color: '#475569' }}>
            IMP tích hợp các tiện ích tự động hóa để tăng tốc độ nhập liệu và giảm thiểu sai sót thủ công:
          </Paragraph>
          <ul style={{ paddingLeft: 18, color: '#475569', fontSize: 13, lineHeight: '1.8' }}>
            <li>
              <strong>Tự động gợi ý Tem nhãn phụ</strong>: 
              Khi người dùng chọn hoặc thêm sản phẩm vào danh mục của Invoice, hệ thống sẽ tự động đối chiếu với danh sách cấu hình trong Master Data (Liên kết SP - Tem) và **tự động gợi ý danh sách các loại tem cần bổ sung** tương ứng cho sản phẩm đó. Người dùng vẫn hoàn toàn có thể tùy chỉnh, thêm hoặc xóa tem trực tiếp trên giao diện Drawer sản phẩm.
            </li>
            <li>
              <strong>Tự động điền (Autofill) thông tin Visa/Quyết định từ lịch sử gần nhất</strong>: 
              Khi thêm sản phẩm vào Invoice, hệ thống sẽ tự động tìm kiếm trong cơ sở dữ liệu các lô hàng đã nhập trước đó của sản phẩm này để lấy ra 3 trường thông tin: <strong>Số Visa</strong>, <strong>Số quyết định</strong>, và <strong>Hiệu lực đến</strong> của lô hàng gần nhất rồi **tự động điền** vào form. Người dùng vẫn có thể chỉnh sửa lại các thông tin này nếu lô hàng mới có sự thay đổi.
            </li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <Card
      style={{
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.6)',
        background: 'rgba(255, 255, 255, 0.75)',
        boxShadow: '0 8px 32px rgba(13,148,136,0.04)',
        backdropFilter: 'blur(8px)',
        overflow: 'hidden',
        minHeight: 'calc(100vh - 280px)',
      }}
      bodyStyle={{ padding: '16px 24px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div
          style={{
            padding: 8,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(13,148,136,0.2)',
          }}
        >
          <BookOpen size={20} color="#fff" />
        </div>
        <div>
          <Title level={3} style={{ margin: 0, color: '#0f766e' }}>
            Tài liệu Hướng dẫn sử dụng
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Chi tiết luồng quy trình, logic chặn nghiệp vụ và phân quyền người dùng GxP
          </Text>
        </div>
      </div>

      <Divider style={{ margin: '0 0 16px' }} />

      <Tabs
        defaultActiveKey="general"
        items={sections}
        type="line"
        size="large"
        tabBarStyle={{ marginBottom: 16 }}
      />
    </Card>
  );
}
