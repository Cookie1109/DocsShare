const { GoogleGenerativeAI } = require('@google/generative-ai');
const { executeQuery } = require('../config/db');

// Khởi tạo Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Test endpoint - Liệt kê các models có sẵn
 */
async function listAvailableModels() {
  try {
    const models = await genAI.listModels();
    return models;
  } catch (error) {
    console.error('Error listing models:', error);
    throw error;
  }
}

/**
 * Chatbot Controller - Xử lý tìm kiếm tài liệu thông minh bằng AI
 */
class ChatbotController {
  /**
   * Lấy danh sách files từ các nhóm mà user tham gia
   * @param {string} userId - Firebase UID của user
   * @returns {Promise<Array>} Danh sách files với metadata
   */
  static async getUserAccessibleFiles(userId) {
    try {
      const query = `
        SELECT 
          f.id,
          f.name,
          f.mime_type,
          f.size_bytes,
          f.storage_path,
          f.created_at,
          f.download_count,
          g.id as group_id,
          g.name as group_name,
          u.display_name as uploader_name,
          u.tag as uploader_tag,
          GROUP_CONCAT(DISTINCT t.name SEPARATOR ', ') as tags
        FROM files f
        INNER JOIN \`groups\` g ON f.group_id = g.id
        INNER JOIN group_members gm ON g.id = gm.group_id
        INNER JOIN users u ON f.uploader_id = u.id
        LEFT JOIN file_tags ft ON f.id = ft.file_id
        LEFT JOIN tags t ON ft.tag_id = t.id
        WHERE gm.user_id = ?
        GROUP BY f.id, f.name, f.mime_type, f.size_bytes, f.storage_path, 
                 f.created_at, f.download_count, g.id, g.name, u.display_name, u.tag
        ORDER BY f.created_at DESC
      `;

      const files = await executeQuery(query, [userId]);
      return files;
    } catch (error) {
      console.error('Error fetching user accessible files:', error);
      throw error;
    }
  }

  /**
   * Tạo context cho AI từ danh sách files
   * @param {Array} files - Danh sách files
   * @returns {string} Context cho AI
   */
  static createFilesContext(files) {
    if (!files || files.length === 0) {
      return 'Người dùng chưa có file nào trong các nhóm của họ.';
    }

    let context = `Danh sách tài liệu có sẵn (${files.length} files):\n\n`;
    
    files.forEach((file, index) => {
      const uploadDate = new Date(file.created_at);
      const formattedDate = uploadDate.toLocaleDateString('vi-VN');
      const sizeInMB = (file.size_bytes / (1024 * 1024)).toFixed(2);
      
      context += `${index + 1}. File: "${file.name}"\n`;
      context += `   - ID: ${file.id}\n`;
      context += `   - Nhóm: ${file.group_name}\n`;
      context += `   - Người upload: ${file.uploader_name}#${file.uploader_tag}\n`;
      context += `   - Ngày upload: ${formattedDate}\n`;
      context += `   - Loại file: ${file.mime_type}\n`;
      context += `   - Kích thước: ${sizeInMB} MB\n`;
      context += `   - Số lượt tải: ${file.download_count}\n`;
      if (file.tags) {
        context += `   - Tags: ${file.tags}\n`;
      }
      context += '\n';
    });

    return context;
  }

  /**
   * Xử lý tin nhắn chat từ user và trả về kết quả tìm kiếm
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  static async chat(req, res) {
    try {
      console.log('🤖 Chatbot chat request received');
      console.log('User ID:', req.user?.uid);
      console.log('Username:', req.user?.username);
      console.log('Message:', req.body?.message);
      
      const { message, conversationHistory = [] } = req.body;
      const userId = req.user.uid;

      if (!message || message.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Tin nhắn không được để trống'
        });
      }

      // Lấy danh sách files mà user có quyền truy cập
      const files = await ChatbotController.getUserAccessibleFiles(userId);
      const filesContext = ChatbotController.createFilesContext(files);

      // Lấy thông tin user hiện tại từ req.user
      const currentUsername = req.user.username || 'Người dùng'; // Đã có format Name#Tag từ middleware
      const currentUserId = req.user.uid;
      
      // Tạo prompt cho AI
      const systemPrompt = `Bạn là trợ lý tìm kiếm tài liệu thông minh của DocsShare. 
Nhiệm vụ của bạn là giúp người dùng tìm kiếm và quản lý tài liệu một cách hiệu quả.

THÔNG TIN NGƯỜI DÙNG HIỆN TẠI:
- Username: ${currentUsername}
- User ID: ${currentUserId}
- Đang đăng nhập và sử dụng chatbot

QUAN TRỌNG VỀ NGỮ CẢNH:
- Khi người dùng nói "tôi", "của tôi", "mình", "file của tôi" → ÁM CHỈ CHÍNH NGƯỜI DÙNG ${currentUsername}
- Trong danh sách file, tìm file có "Người upload: ${currentUsername}"
- Ví dụ: "tổng hợp file của tôi" = tìm tất cả file có "Người upload: ${currentUsername}"
- Ví dụ: "file tôi upload" = file có "Người upload: ${currentUsername}"
- Khi muốn tìm file của NGƯỜI KHÁC, người dùng sẽ nói rõ tên và tag: "file của Nhan#1109", "tài liệu do Linh#2011 upload"
- CHÚ Ý: Phân biệt chính xác username#tag, ví dụ Nhân#6039 ≠ Nhan#1109 (khác cả tên lẫn tag)

FORMAT TRẢ LỜI - CHỈ TRẢ VỀ JSON ĐÚNG FORMAT, KHÔNG GIẢI THÍCH THÊM:
{
  "response": "Câu trả lời ngắn gọn, thân thiện bằng tiếng Việt. KHÔNG bao gồm cấu trúc JSON hay danh sách ID trong câu trả lời.",
  "fileIds": [mảng số ID của các file tìm thấy, ví dụ: [1, 5, 10]],
  "suggestion": "Gợi ý hành động tiếp theo nếu cần"
}

VÍ DỤ TRẢ LỜI ĐÚNG:
{
  "response": "Tuyệt vời! Tôi đã tìm thấy 7 tài liệu được tải lên trong vòng 1 tháng gần đây.",
  "fileIds": [33, 21, 20, 19, 18, 17, 16],
  "suggestion": "Bạn có muốn lọc các tài liệu này theo người tải lên hoặc theo loại file không?"
}

VÍ DỤ TRẢ LỜI SAI (ĐỪNG LÀM NHƯ THẾ NÀY):
{
  "response": "Dựa trên yêu cầu của bạn, đây là danh sách các ID file liên quan: {...}",
  "fileIds": [...]
}

KHẢ NĂNG CỦA BẠN:
1. Tìm kiếm file theo tên (có thể mơ hồ, không cần chính xác 100%)
2. Tìm file theo người upload (phân biệt "tôi" vs tên người khác)
3. Tìm file theo ngày tháng (hôm qua, tuần trước, tháng này...)
4. Tìm file theo nhóm
5. Tìm file theo loại file (PDF, DOC, ảnh, video...)
6. Tìm file theo tags
7. Tổng hợp tất cả file (của tôi hoặc của người khác)
8. Sắp xếp theo lượt tải, ngày upload, kích thước...

HƯỚNG DẪN TRẢ LỜI:
- Luôn thân thiện, chuyên nghiệp và hữu ích
- Hiểu rõ "tôi" = ${currentUsername}, không nhầm với người dùng khác
- Nếu tìm thấy file, trả về mảng fileIds với các ID phù hợp
- Nếu không tìm thấy, fileIds = [] và giải thích tại sao
- Gợi ý cách tìm kiếm tốt hơn nếu không có kết quả
- Hỗ trợ ngôn ngữ tự nhiên, hiểu ngữ cảnh tiếng Việt

THÔNG TIN TÀI LIỆU HIỆN TẠI:
${filesContext}

LƯU Ý: 
- Chỉ trả về các file ID có trong danh sách trên
- Ngày hôm nay: ${new Date().toLocaleDateString('vi-VN')}
- Luôn trả về valid JSON`;

      // Dùng gemini-2.5-flash - model mới nhất có sẵn
      const model = genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash' });
      
      const prompt = `${systemPrompt}\n\nNgười dùng hỏi: ${message}`;
      
      const result = await model.generateContent(prompt);
      const response = result.response;
      let aiText = response.text();

      // Parse JSON response từ AI
      let parsedResponse;
      try {
        // Loại bỏ markdown code blocks nếu có
        aiText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsedResponse = JSON.parse(aiText);
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        // Fallback nếu AI không trả về JSON đúng format
        parsedResponse = {
          response: aiText,
          fileIds: [],
          suggestion: 'Vui lòng thử lại với câu hỏi cụ thể hơn'
        };
      }

      // Lấy thông tin chi tiết của các files được tìm thấy
      let foundFiles = [];
      if (parsedResponse.fileIds && parsedResponse.fileIds.length > 0) {
        foundFiles = files.filter(file => 
          parsedResponse.fileIds.includes(file.id)
        );
      }

      return res.json({
        success: true,
        data: {
          message: parsedResponse.response,
          files: foundFiles,
          suggestion: parsedResponse.suggestion || null,
          totalFilesAvailable: files.length
        }
      });

    } catch (error) {
      console.error('Chatbot error:', error);
      return res.status(500).json({
        success: false,
        error: 'Đã xảy ra lỗi khi xử lý yêu cầu',
        details: error.message
      });
    }
  }

  /**
   * Lấy thống kê files cho chatbot
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  static async getStats(req, res) {
    try {
      const userId = req.user.uid;

      const statsQuery = `
        SELECT 
          COUNT(DISTINCT f.id) as total_files,
          COUNT(DISTINCT g.id) as total_groups,
          COUNT(DISTINCT f.uploader_id) as total_uploaders,
          SUM(f.size_bytes) as total_size,
          COUNT(DISTINCT t.id) as total_tags
        FROM files f
        INNER JOIN \`groups\` g ON f.group_id = g.id
        INNER JOIN group_members gm ON g.id = gm.group_id
        LEFT JOIN file_tags ft ON f.id = ft.file_id
        LEFT JOIN tags t ON ft.tag_id = t.id
        WHERE gm.user_id = ?
      `;

      const [stats] = await executeQuery(statsQuery, [userId]);

      return res.json({
        success: true,
        data: {
          totalFiles: stats.total_files || 0,
          totalGroups: stats.total_groups || 0,
          totalUploaders: stats.total_uploaders || 0,
          totalSize: stats.total_size || 0,
          totalTags: stats.total_tags || 0
        }
      });

    } catch (error) {
      console.error('Error getting stats:', error);
      return res.status(500).json({
        success: false,
        error: 'Không thể lấy thống kê'
      });
    }
  }

  /**
   * Test endpoint - List available models
   */
  static async testModels(req, res) {
    try {
      const models = await listAvailableModels();
      return res.json({
        success: true,
        models: models
      });
    } catch (error) {
      console.error('Error testing models:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = ChatbotController;
