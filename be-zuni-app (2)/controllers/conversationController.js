const ConversationService = require("../services/conversationService");

const createConversation = async (req, res) => {
  try {
    const { participants, type, name, avatar, settings } = req.body;
    const userId = req.user.userId;

    // Thêm người dùng hiện tại vào danh sách participants nếu chưa có
    if (!participants.includes(userId)) {
      participants.push(userId);
    }

    // Kiểm tra loại cuộc trò chuyện
    if (type === "group" && participants.length < 3) {
      return res.status(400).json({
        status: false,
        error: 400,
        message: "Nhóm chat phải có ít nhất 3 thành viên",
        data: null,
      });
    }

    const conversationData = {
      participants,
      type: type === "direct" ? "private" : type,
      name,
      avatar,
      settings,
      creator: userId,
    };

    const conversation = await ConversationService.createConversation(
      conversationData
    );
    res.status(201).json({
      status: true,
      error: 0,
      message: "Tạo cuộc trò chuyện thành công",
      data: {
        ...conversation,
        participants,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      error: 500,
      message: error.message,
      data: null,
    });
  }
};

const getConversations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const conversations = await ConversationService.getConversationsByUser(
      userId
    );

    res.status(200).json({
      status: true,
      error: 0,
      message: "Lấy danh sách cuộc trò chuyện thành công",
      data: conversations,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      error: 500,
      message: error.message,
      data: null,
    });
  }
};

const getConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await ConversationService.getConversationById(
      conversationId
    );

    if (!conversation) {
      return res.status(404).json({
        status: false,
        error: 404,
        message: "Không tìm thấy cuộc trò chuyện",
        data: null,
      });
    }

    res.status(200).json({
      status: true,
      error: 0,
      message: "Lấy thông tin cuộc trò chuyện thành công",
      data: conversation,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      error: 500,
      message: error.message,
      data: null,
    });
  }
};

const updateConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const updateData = req.body;

    const conversation = await ConversationService.updateConversation(
      conversationId,
      updateData
    );

    res.status(200).json({
      status: true,
      error: 0,
      message: "Cập nhật cuộc trò chuyện thành công",
      data: conversation,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      error: 500,
      message: error.message,
      data: null,
    });
  }
};

const deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const requesterId = req.user.userId;

    await ConversationService.deleteConversation(conversationId, requesterId);

    res.status(200).json({
      status: true,
      error: 0,
      message: "Xóa cuộc trò chuyện thành công",
      data: null,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      error: 500,
      message: error.message,
      data: null,
    });
  }
};

const addParticipants = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { participants } = req.body;

    const conversation = await ConversationService.addParticipants(
      conversationId,
      participants
    );

    res.status(200).json({
      status: true,
      error: 0,
      message: "Thêm thành viên vào cuộc trò chuyện thành công",
      data: conversation,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      error: 500,
      message: error.message,
      data: null,
    });
  }
};

const removeParticipants = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { participants } = req.body;
    const requesterId = req.user.userId;

    const conversation = await ConversationService.removeParticipants(
      conversationId,
      participants,
      requesterId
    );

    res.status(200).json({
      status: true,
      error: 0,
      message: "Xóa thành viên khỏi cuộc trò chuyện thành công",
      data: conversation,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      error: 500,
      message: error.message,
      data: null,
    });
  }
};

const getGroupConversations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const groupConversations =
      await ConversationService.getGroupConversationsByUser(userId);

    res.status(200).json({
      status: true,
      error: 0,
      message: "Lấy danh sách nhóm chat thành công",
      data: groupConversations,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      error: 500,
      message: error.message,
      data: null,
    });
  }
};

const leaveGroup = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    const conversation = await ConversationService.leaveGroup(
      conversationId,
      userId
    );

    res.status(200).json({
      status: true,
      error: 0,
      message: "Rời khỏi nhóm thành công",
      data: conversation,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      error: 500,
      message: error.message,
      data: null,
    });
  }
};

module.exports = {
  createConversation,
  getConversations,
  getConversation,
  updateConversation,
  deleteConversation,
  addParticipants,
  removeParticipants,
  getGroupConversations,
  leaveGroup,
};
