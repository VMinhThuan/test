import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AiFillLike, AiOutlineUsergroupAdd, AiFillHeart } from "react-icons/ai";
import { IoSearchOutline, IoSend } from "react-icons/io5";
import { TbColumns2 } from "react-icons/tb";
import { PiTagSimple, PiSmiley } from "react-icons/pi";
import { RiMoreLine } from "react-icons/ri";
import { LuSticker } from "react-icons/lu";
import {
  FaRegImage,
  FaFile,
  FaFilePdf,
  FaFileExcel,
  FaFilePowerpoint,
  FaFileWord,
  FaFileCode,
  FaFileCsv,
} from "react-icons/fa6";
import { FaFileArchive, FaQuoteRight } from "react-icons/fa";
import { IoIosShareAlt } from "react-icons/io";
import { GoPaperclip } from "react-icons/go";
import { Spin } from "antd";
import {
  LoadingOutlined,
  UserAddOutlined,
  HeartOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { HiOutlineVideoCamera } from "react-icons/hi";
import { BsFiletypeMp3, BsFiletypeMp4, BsFiletypeTxt } from "react-icons/bs";
import {
  getUserByIdApi,
  sendFriendRequestApi,
  checkSentFriendRequestApi,
  checkReceivedFriendRequestApi,
  createConversationApi,
  getMessagesApi,
  sendMessageApi,
  getConversationsApi,
  acceptFriendRequestApi,
  rejectFriendRequestApi,
  uploadMessageImageApi,
  uploadMessageFileApi,
  getReactionsForMessagesApi,
  getUserStatusApi,
  updateUserStatusApi,
  deleteMessageApi,
} from "../../services/api";
import { useCurrentApp } from "../../contexts/app.context";
import { useSocket } from "../../contexts/socket.context";
import ImageViewModal from "../../components/modal/image.modal";
import UserInfoModal from "../../components/modal/user.modal";
import ReactionModal from "../../components/modal/reaction.modal";
import EmojiPicker from "../../components/emoji/EmojiPicker";
import CreateGroupModal from "../../components/modal/group.modal";
import MessageDropdown from "../../components/dropdown/message.dropdown";
import defaultAvatar from "../../assets/images/defaultAvatar.jpg";

const ChatPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, messageApi, setUser } = useCurrentApp();
  const { socket } = useSocket();
  const [chatUser, setChatUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasSentRequest, setHasSentRequest] = useState(false);
  const [hasReceivedRequest, setHasReceivedRequest] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUserInfoModalOpen, setIsUserInfoModalOpen] = useState(false);
  const [likedMessages, setLikedMessages] = useState({});
  const [messageReactions, setMessageReactions] = useState({});
  const [showReactionModal, setShowReactionModal] = useState(false);
  const [selectedMessageReactions, setSelectedMessageReactions] =
    useState(null);
  const [reactedUserDetails, setReactedUserDetails] = useState({});
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [chatUserTyping, setChatUserTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pastedImage, setPastedImage] = useState(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  const messagesEndRef = useRef(null);
  const bottomRef = useRef(null);
  const messageInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const fetchMessageReactions = async () => {
    if (!conversationId || messages.length === 0) return;

    try {
      // Lấy danh sách messageIds từ tin nhắn
      const messageIds = messages.map((msg) => msg.messageId).filter(Boolean);

      if (messageIds.length === 0) return;
      console.log("Fetching reactions for messages:", messageIds);

      // Gọi API để lấy reactions cho tất cả tin nhắn
      const res = await getReactionsForMessagesApi(messageIds);

      if (res.status) {
        // Lưu reactions vào state
        setMessageReactions(res.data.reactions);

        // Cập nhật UI hiển thị số lượt tim
        const likesCount = {};
        Object.entries(res.data.reactions).forEach(([messageId, reactions]) => {
          likesCount[messageId] = Object.values(reactions).reduce(
            (sum, reaction) => sum + reaction.count,
            0
          );
        });
        setLikedMessages(likesCount);
      }
    } catch (error) {
      console.error("Lỗi khi tải reactions:", error);
    }
  };

  const fetchMessages = async (convId) => {
    try {
      console.log("Fetching messages for conversation:", convId);
      const res = await getMessagesApi(convId);
      console.log("Messages response:", res);

      if (res.status && Array.isArray(res.data?.messages)) {
        // Chỉ lọc tin nhắn trùng lặp dựa trên messageId
        const uniqueMessages = [];
        const messageIds = new Set();

        res.data.messages.forEach((msg) => {
          if (msg.messageId && !messageIds.has(msg.messageId)) {
            messageIds.add(msg.messageId);
            uniqueMessages.push(msg);
          } else if (!msg.messageId) {
            // Nếu không có messageId, vẫn giữ lại tin nhắn
            uniqueMessages.push(msg);
          }
        });

        setMessages(uniqueMessages);
        scrollToBottom();
      } else {
        console.error("Invalid messages response:", res);
        setMessages([]);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      messageApi.open({
        type: "error",
        content: "Không thể tải tin nhắn",
      });
      setMessages([]);
    }
  };

  const checkFriendRequestStatus = async (userId) => {
    try {
      const [sentRes, receivedRes] = await Promise.all([
        checkSentFriendRequestApi(userId),
        checkReceivedFriendRequestApi(userId),
      ]);

      if (sentRes.status) {
        setHasSentRequest(sentRes.data.hasSentRequest);
      }

      if (receivedRes.status) {
        setHasReceivedRequest(receivedRes.data.hasReceivedRequest);
      }
    } catch (error) {
      console.error("Error checking friend request status:", error);
    }
  };

  useEffect(() => {
    // Kiểm tra ngay từ đầu, trước khi gọi API
    if (id === currentUser?.userId) {
      messageApi.open({
        type: "error",
        content: "Bạn không thể chat với chính mình",
        key: "self-chat-error", // Thêm key để tránh hiển thị trùng lặp
      });
      navigate("/");
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Bước 1: Kiểm tra xem id có phải là conversation ID của nhóm chat không
        const conversationsRes = await getConversationsApi();
        const existingGroupConversation = conversationsRes.data?.find(
          (conv) => conv.conversationId === id && conv.type === "group"
        );

        // Nếu tìm thấy conversation là nhóm chat
        if (existingGroupConversation) {
          console.log("Loading group conversation:", existingGroupConversation);
          // Sử dụng thông tin từ nhóm chat để tạo chatUser
          setChatUser({
            userId: existingGroupConversation.conversationId,
            fullName: existingGroupConversation.name || "Nhóm chat",
            avatar: existingGroupConversation.avatar,
            isGroup: true,
            participants: existingGroupConversation.participants,
            isFriend: true, // Để không hiển thị UI kết bạn
          });

          setConversationId(existingGroupConversation.conversationId);
          await fetchMessages(existingGroupConversation.conversationId);
          setIsLoading(false);
          return;
        }

        // Nếu không phải nhóm chat, xử lý theo logic cũ (tìm người dùng)
        const res = await getUserByIdApi(id);
        if (res.status) {
          const userData = {
            ...res.data,
            isFriend: currentUser?.contacts?.includes(res.data.userId),
          };
          setChatUser(userData);

          // Kiểm tra trạng thái lời mời kết bạn nếu chưa là bạn bè
          if (!userData.isFriend) {
            await checkFriendRequestStatus(res.data.userId);
          }

          // Tìm hoặc tạo conversation cho chat 1-1
          const participants = [currentUser.userId, res.data.userId].sort();
          const conversationKey = `private_${participants.join("_")}`;

          console.log(
            "Creating/getting conversation with key:",
            conversationKey
          );

          // Tìm conversation private giữa 2 người dùng
          const existingPrivateConversation = conversationsRes.data?.find(
            (conv) =>
              conv.participants.includes(currentUser.userId) &&
              conv.participants.includes(res.data.userId) &&
              conv.type === "private"
          );

          let conversationId;
          if (existingPrivateConversation) {
            console.log(
              "Using existing conversation:",
              existingPrivateConversation
            );
            conversationId = existingPrivateConversation.conversationId;
          } else {
            const convRes = await createConversationApi({
              participants,
              type: "private",
              conversationId: conversationKey,
            });

            if (convRes.status && convRes.data?.conversationId) {
              console.log("Created new conversation:", convRes.data);
              conversationId = convRes.data.conversationId;
            } else {
              throw new Error("Không thể tạo cuộc trò chuyện");
            }
          }

          setConversationId(conversationId);
          await fetchMessages(conversationId);
        } else {
          // Nếu không tìm thấy người dùng và cũng không phải là nhóm chat
          messageApi.open({
            type: "error",
            content: "Không tìm thấy người dùng hoặc nhóm chat",
          });
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        messageApi.open({
          type: "error",
          content: "Có lỗi xảy ra khi tải dữ liệu",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (id && currentUser?.userId) {
      fetchData();
    }
  }, [id, currentUser?.userId, currentUser?.contacts]);

  useEffect(() => {
    if (!socket || !conversationId || !currentUser?.userId) return;

    // Join conversation room
    socket.emit("join-conversation", {
      conversationId,
      userId: currentUser.userId,
    });

    console.log(`Đã join room conversation: ${conversationId}`);

    // Lắng nghe tin nhắn mới
    const handleReceiveMessage = (data) => {
      console.log("Received message:", data);
      if (data.conversationId === conversationId) {
        setMessages((prev) => {
          const messageExists = prev.some(
            (msg) => msg.messageId === data.messageId
          );
          if (messageExists) return prev;
          return [...prev, data];
        });
        scrollToBottom();
      }
    };

    // Lắng nghe sự kiện thả tim tin nhắn
    const handleMessageReaction = (data) => {
      console.log("Nhận sự kiện message-reaction:", data);
      if (data.messageId && data.reactions) {
        // Lưu dữ liệu reactions chi tiết vào state
        setMessageReactions((prev) => {
          console.log("Cập nhật messageReactions:", {
            current: prev[data.messageId],
            new: data.reactions,
          });
          return {
            ...prev,
            [data.messageId]: data.reactions,
          };
        });

        // Tính tổng số lượt thả tim
        const totalLikes = Object.values(data.reactions).reduce(
          (sum, reaction) => sum + reaction.count,
          0
        );

        console.log(
          `Cập nhật UI cho message ${data.messageId}, total likes: ${totalLikes}`
        );

        setLikedMessages((prev) => ({
          ...prev,
          [data.messageId]: totalLikes,
        }));
      }
    };

    // Lắng nghe sự kiện trạng thái hoạt động
    const handleUserStatusChange = (data) => {
      if (data.userId === chatUser?.userId) {
        setChatUser((prev) => ({
          ...prev,
          isOnline: data.status === "online",
          lastActive:
            data.status === "offline"
              ? new Date().toISOString()
              : prev.lastActive,
        }));
      }
    };

    // Đăng ký lắng nghe sự kiện
    console.log("Socket: đăng ký lắng nghe sự kiện");
    socket.on("receive-message", handleReceiveMessage);
    socket.on("message-reaction", handleMessageReaction);
    socket.on("user-status-change", handleUserStatusChange);

    // Gửi trạng thái online của người dùng hiện tại
    socket.emit("user-status", {
      userId: currentUser.userId,
      status: "online",
    });

    // Cập nhật trạng thái online trong cơ sở dữ liệu
    updateUserStatusApi({
      isOnline: true,
    });

    return () => {
      console.log(`Socket: rời khỏi room ${conversationId}`);
      socket.emit("leave-conversation", {
        conversationId,
        userId: currentUser.userId,
      });

      console.log("Socket: hủy đăng ký lắng nghe sự kiện");
      socket.off("receive-message", handleReceiveMessage);
      socket.off("message-reaction", handleMessageReaction);
      socket.off("user-status-change", handleUserStatusChange);
    };
  }, [socket, conversationId, currentUser?.userId, chatUser?.userId]);

  useEffect(() => {
    if (messages.length > 0 && conversationId) {
      fetchMessageReactions();
    }
  }, [messages.length, conversationId]);

  useEffect(() => {
    if (chatUser && !isLoading) {
      messageInputRef.current?.focus();
    }
  }, [chatUser, isLoading]);

  const createNewConversation = async () => {
    try {
      const convRes = await createConversationApi({
        participants: [currentUser.userId, chatUser.userId],
        type: "private",
      });

      console.log("Create conversation response:", convRes);

      if (convRes.status && convRes.data?.conversationId) {
        const newConversationId = convRes.data.conversationId;
        setConversationId(newConversationId);

        // Join conversation ngay sau khi tạo
        if (socket) {
          socket.emit("join-conversation", {
            conversationId: newConversationId,
            userId: currentUser.userId,
            chatUserId: chatUser.userId,
          });
        }

        return newConversationId;
      }
      throw new Error("Không thể tạo cuộc trò chuyện");
    } catch (error) {
      console.error("Error creating conversation:", error);
      throw error;
    }
  };

  const handleSendMessage = async (e) => {
    if ((e.key === "Enter" || !e.key) && (newMessage.trim() || pastedImage)) {
      e.preventDefault();

      // Tạo messageId tạm thời
      const tempMessageId = `temp_${Date.now()}`;

      try {
        if (!conversationId) {
          throw new Error("Không tìm thấy cuộc trò chuyện");
        }

        // Xử lý trường hợp có ảnh được paste
        if (pastedImage) {
          // Tạo tin nhắn tạm thời để hiển thị trạng thái đang tải
          const tempMessage = {
            conversationId,
            senderId: currentUser.userId,
            receiverId: chatUser.userId,
            type: "image",
            content: "Đang tải ảnh...",
            messageId: tempMessageId,
            createdAt: Date.now(),
            status: "sending",
            messageText: newMessage.trim(), // Lưu nội dung tin nhắn kèm theo
            sender: {
              id: currentUser.userId,
              name: currentUser.fullName,
              avatar: currentUser.avatar,
            },
          };

          // Thêm tin nhắn vào state ngay lập tức
          setMessages((prev) => [...prev, tempMessage]);
          scrollToBottom();

          // Tạo form data để gửi ảnh
          const formData = new FormData();
          formData.append("image", pastedImage.file);
          formData.append("conversationId", conversationId);
          formData.append(
            "fileName",
            pastedImage.file.name || "pasted-image.png"
          );

          // Thêm messageText vào formData nếu có
          if (newMessage.trim()) {
            formData.append("messageText", newMessage.trim());
          }

          console.log("FormData được tạo:", {
            file: pastedImage.file.name,
            conversationId: conversationId,
            fileName: pastedImage.file.name,
            messageText: newMessage.trim() || "không có",
          });

          // Gửi ảnh lên server
          console.log("Đang gọi API uploadMessageImageApi");
          const response = await uploadMessageImageApi(formData);
          console.log("Upload image response:", response);

          if (response.status) {
            // Kiểm tra xem API đã tự tạo tin nhắn trong database chưa
            if (response.data && response.data.messageId) {
              console.log(
                "Đã tìm thấy messageId từ uploadMessageImageApi:",
                response.data.messageId
              );

              // Đảm bảo metadata có dạng object
              let metadataObj = {};
              try {
                if (typeof response.data.metadata === "string") {
                  metadataObj = JSON.parse(response.data.metadata);
                } else if (typeof response.data.metadata === "object") {
                  metadataObj = response.data.metadata;
                }
              } catch (e) {
                console.error("Lỗi parse metadata:", e);
              }

              // Cập nhật tin nhắn với thông tin từ server
              const finalMessage = {
                ...response.data,
                content: response.data.url || response.data.content,
                type: "image",
                status: "sent",
                senderId: currentUser.userId,
                receiverId: chatUser.userId,
                metadata: metadataObj,
                sender: {
                  id: currentUser.userId,
                  name: currentUser.fullName,
                  avatar: currentUser.avatar,
                },
              };

              // Cập nhật tin nhắn với thông tin thật từ server
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.messageId === tempMessageId ? finalMessage : msg
                )
              );

              // Emit socket event
              socket?.emit("send-message", {
                ...finalMessage,
                conversationId,
                to: chatUser.userId,
              });

              // Emit thêm sự kiện send-message-success
              socket?.emit("send-message-success", {
                ...finalMessage,
                conversationId,
                sender: {
                  id: currentUser.userId,
                  name: currentUser.fullName,
                  avatar: currentUser.avatar,
                },
              });

              // Xóa ảnh đã paste và reset input
              clearPastedImage();
              setNewMessage("");
              messageInputRef.current?.focus();
            } else {
              // Nếu API không tạo message, chúng ta sẽ tạo
              // Tạo dữ liệu tin nhắn kèm nội dung text
              const messageData = {
                conversationId,
                senderId: currentUser.userId,
                receiverId: chatUser.userId,
                type: "image",
                content: response.data.url || response.data.content,
                metadata: JSON.stringify({
                  fileName: pastedImage.file.name || "pasted-image.png",
                  fileSize: pastedImage.file.size,
                  mimeType: pastedImage.file.type,
                  originalUpload: true,
                  messageText: newMessage.trim(), // Lưu nội dung tin nhắn vào metadata
                }),
              };

              // Gọi API lưu tin nhắn
              const messageResponse = await sendMessageApi(messageData);

              if (messageResponse.status) {
                const finalMessage = {
                  ...messageResponse.data,
                  content: response.data.url || response.data.content,
                  type: "image",
                  status: "sent",
                  senderId: currentUser.userId,
                  receiverId: chatUser.userId,
                  messageText: newMessage.trim(),
                  sender: {
                    id: currentUser.userId,
                    name: currentUser.fullName,
                    avatar: currentUser.avatar,
                  },
                };

                // Cập nhật tin nhắn với thông tin thật từ server
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.messageId === tempMessageId ? finalMessage : msg
                  )
                );

                // Emit socket event
                socket?.emit("send-message", {
                  ...finalMessage,
                  conversationId,
                  to: chatUser.userId,
                });

                // Emit thêm sự kiện send-message-success
                socket?.emit("send-message-success", {
                  ...finalMessage,
                  conversationId,
                  sender: {
                    id: currentUser.userId,
                    name: currentUser.fullName,
                    avatar: currentUser.avatar,
                  },
                });

                // Xóa ảnh đã paste
                clearPastedImage();
                setNewMessage("");
                messageInputRef.current?.focus();
              } else {
                throw new Error(
                  messageResponse.message || "Gửi tin nhắn thất bại"
                );
              }
            }
          } else {
            throw new Error(response.message || "Gửi ảnh thất bại");
          }
        } else {
          // Xử lý gửi tin nhắn văn bản thông thường (code cũ)
          const messageData = {
            conversationId,
            senderId: currentUser.userId,
            receiverId: chatUser.userId,
            type: "text",
            content: newMessage.trim(),
          };

          const tempMessage = {
            ...messageData,
            messageId: tempMessageId,
            createdAt: Date.now(),
            status: "sending",
            sender: {
              id: currentUser.userId,
              name: currentUser.fullName,
              avatar: currentUser.avatar,
            },
          };

          // Thêm tin nhắn vào state ngay lập tức
          setMessages((prev) => [...prev, tempMessage]);
          scrollToBottom();
          setNewMessage("");
          messageInputRef.current?.focus();

          // Gửi tin nhắn lên server ở background
          const messageResponse = await sendMessageApi(messageData);

          if (messageResponse.status && messageResponse.data) {
            const finalMessage = {
              ...messageData,
              messageId: messageResponse.data.messageId,
              createdAt: messageResponse.data.createdAt,
              status: "sent",
              sender: {
                id: currentUser.userId,
                name: currentUser.fullName,
                avatar: currentUser.avatar,
              },
            };

            // Cập nhật tin nhắn với messageId thật từ server
            setMessages((prev) =>
              prev.map((msg) =>
                msg.messageId === tempMessageId ? finalMessage : msg
              )
            );

            // Emit socket event cho cả người gửi và người nhận
            socket.emit("send-message", {
              ...finalMessage,
              conversationId,
              to: chatUser.userId, // Thêm thông tin người nhận
            });

            // Emit thêm sự kiện send-message-success
            socket.emit("send-message-success", {
              ...finalMessage,
              conversationId,
              sender: {
                id: currentUser.userId,
                name: currentUser.fullName,
                avatar: currentUser.avatar,
              },
            });
          } else {
            throw new Error(messageResponse.message || "Gửi tin nhắn thất bại");
          }
        }
      } catch (error) {
        console.error("Error sending message:", error);
        // Xóa tin nhắn tạm thời nếu gửi thất bại
        setMessages((prev) =>
          prev.filter((msg) => msg.messageId !== tempMessageId)
        );
        messageApi.open({
          type: "error",
          content: error.message || "Gửi tin nhắn thất bại",
        });
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (conversationId) {
      fetchMessages(conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Khi gửi tin nhắn, dừng trạng thái typing
      if (isTyping) {
        setIsTyping(false);
        socket.emit("stop-typing", { conversationId });
      }

      // Chỉ gửi tin nhắn khi có nội dung hoặc có ảnh được paste
      if (newMessage.trim() || pastedImage) {
        handleSendMessage(e);
      }
      // Đã loại bỏ phần gọi handleSendLike khi input trống
    }
  };

  const handleSendRequest = async () => {
    if (!chatUser?.userId) return;

    setSending(true);
    try {
      const res = await sendFriendRequestApi(chatUser.userId);
      if (res.status) {
        messageApi.open({
          type: "success",
          content: res.message || "Đã gửi lời mời kết bạn",
        });
        setHasSentRequest(true);

        // Emit socket event để cập nhật UI ở sidebar
        if (socket) {
          socket.emit("send-friend-request", {
            receiverId: chatUser.userId,
            senderId: currentUser?.userId,
            senderName: currentUser?.fullName,
            senderAvatar: currentUser?.avatar,
          });
        }
      } else {
        messageApi.open({
          type: "error",
          content: res.message || "Không thể gửi lời mời kết bạn",
        });
      }
    } catch (error) {
      console.error("Error sending friend request:", error);
      messageApi.open({
        type: "error",
        content: "Có lỗi xảy ra khi gửi lời mời kết bạn",
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendLike = async () => {
    const tempMessageId = `temp_${Date.now()}`;
    try {
      let currentConversationId = conversationId;

      if (!currentConversationId) {
        currentConversationId = await createNewConversation();
      }

      // Chuẩn bị dữ liệu tin nhắn dựa vào loại chat
      let messageData;

      if (chatUser?.isGroup) {
        // Tin nhắn trong nhóm chat
        messageData = {
          conversationId: currentConversationId,
          senderId: currentUser.userId,
          type: "text",
          content: "👍",
          senderName: currentUser.fullName,
          senderAvatar: currentUser.avatar,
          isGroupMessage: true,
        };
      } else {
        // Tin nhắn chat 1-1
        messageData = {
          conversationId: currentConversationId,
          senderId: currentUser.userId,
          receiverId: chatUser.userId,
          type: "text",
          content: "👍",
        };
      }

      // Thêm tin nhắn vào state ngay lập tức
      const tempMessage = {
        ...messageData,
        messageId: tempMessageId,
        createdAt: Date.now(),
        status: "sending",
        sender: {
          id: currentUser.userId,
          name: currentUser.fullName,
          avatar: currentUser.avatar,
        },
      };

      setMessages((prev) => [...prev, tempMessage]);
      scrollToBottom();

      // Gửi tin nhắn lên server ở background
      const messageResponse = await sendMessageApi(messageData);

      if (messageResponse.status && messageResponse.data) {
        const finalMessage = {
          ...messageData,
          messageId: messageResponse.data.messageId,
          createdAt: messageResponse.data.createdAt,
          status: "sent",
          sender: {
            id: currentUser.userId,
            name: currentUser.fullName,
            avatar: currentUser.avatar,
          },
        };

        // Cập nhật tin nhắn với messageId thật từ server
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === tempMessageId ? finalMessage : msg
          )
        );

        // Emit socket event - khác nhau cho nhóm và chat 1-1
        if (chatUser?.isGroup) {
          socket.emit("send-message", {
            ...finalMessage,
            conversationId,
            isGroupMessage: true,
          });
        } else {
          socket.emit("send-message", {
            ...finalMessage,
            conversationId,
            to: chatUser.userId,
          });
        }
      } else {
        throw new Error(messageResponse.message || "Gửi tin nhắn thất bại");
      }
    } catch (error) {
      console.error("Error sending like:", error);
      messageApi.open({
        type: "error",
        content: error.message || "Gửi tin nhắn thất bại",
      });
      // Xóa tin nhắn tạm thời nếu gửi thất bại
      setMessages((prev) =>
        prev.filter((msg) => msg.messageId !== tempMessageId)
      );
    }
  };

  const handleAcceptRequest = async () => {
    if (!chatUser?.userId) return;

    setAccepting(true);
    try {
      const res = await acceptFriendRequestApi(chatUser.userId);
      if (res.status) {
        messageApi.open({
          type: "success",
          content: res.message || "Đã chấp nhận lời mời kết bạn",
        });
        setHasReceivedRequest(false);
        setChatUser((prev) => ({
          ...prev,
          isFriend: true,
        }));

        socket?.emit("friend-request-accepted", {
          friendId: chatUser.userId,
          accepterId: currentUser?.userId,
        });
      } else {
        messageApi.open({
          type: "error",
          content: res.message || "Không thể chấp nhận lời mời kết bạn",
        });
      }
    } catch (error) {
      console.error("Error accepting friend request:", error);
      messageApi.open({
        type: "error",
        content: "Có lỗi xảy ra khi chấp nhận lời mời kết bạn",
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!chatUser?.userId) return;

    setRejecting(true);
    try {
      const res = await rejectFriendRequestApi(chatUser.userId);
      if (res.status) {
        messageApi.open({
          type: "success",
          content: res.message || "Đã từ chối lời mời kết bạn",
        });
        setHasReceivedRequest(false);

        socket?.emit("friend-request-rejected", {
          friendId: chatUser.userId,
          rejecterId: currentUser?.userId,
        });
      } else {
        messageApi.open({
          type: "error",
          content: res.message || "Không thể từ chối lời mời kết bạn",
        });
      }
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      messageApi.open({
        type: "error",
        content: "Có lỗi xảy ra khi từ chối lời mời kết bạn",
      });
    } finally {
      setRejecting(false);
    }
  };

  useEffect(() => {
    if (!socket) {
      console.log("❌ Socket chưa được khởi tạo");
      return;
    }

    console.log("🔌 Socket đã kết nối, thiết lập listeners");
    console.log("👤 Current user:", {
      userId: currentUser?.userId,
      contacts: currentUser?.contacts,
    });
    console.log("💬 Chat user:", {
      userId: chatUser?.userId,
      isFriend: chatUser?.isFriend,
    });

    const handleFriendRequestAccepted = (data) => {
      console.log("🤝 ChatPage - Nhận được sự kiện friend-request-accepted:", {
        eventData: data,
        currentUser: {
          userId: currentUser?.userId,
          contacts: currentUser?.contacts,
        },
        chatUser: {
          userId: chatUser?.userId,
          isFriend: chatUser?.isFriend,
        },
      });

      const isCurrentUserInvolved =
        data.friendId === currentUser?.userId ||
        data.accepterId === currentUser?.userId;

      const isChatUserInvolved =
        data.friendId === chatUser?.userId ||
        data.accepterId === chatUser?.userId;

      if (isCurrentUserInvolved || isChatUserInvolved) {
        // Cập nhật trạng thái kết bạn ngay lập tức
        setChatUser((prev) => ({
          ...prev,
          isFriend: true,
        }));

        // Cập nhật contacts trong currentUser
        setUser((prev) => {
          const newContacts = [...(prev.contacts || [])];
          if (!newContacts.includes(chatUser?.userId)) {
            newContacts.push(chatUser?.userId);
          }
          return {
            ...prev,
            contacts: newContacts,
          };
        });

        // Reset trạng thái lời mời
        setHasSentRequest(false);
        setHasReceivedRequest(false);
      }
    };

    const handleFriendRequestRejected = (data) => {
      console.log("👎 ChatPage - Nhận được sự kiện friend-request-rejected:", {
        eventData: data,
        currentUser: {
          userId: currentUser?.userId,
          contacts: currentUser?.contacts,
        },
        chatUser: {
          userId: chatUser?.userId,
          isFriend: chatUser?.isFriend,
        },
      });

      const isCurrentUserInvolved =
        data.friendId === currentUser?.userId ||
        data.rejecterId === currentUser?.userId;

      const isChatUserInvolved =
        data.friendId === chatUser?.userId ||
        data.rejecterId === chatUser?.userId;

      if (isCurrentUserInvolved || isChatUserInvolved) {
        // Cập nhật trạng thái kết bạn ngay lập tức
        setChatUser((prev) => ({
          ...prev,
          isFriend: false,
        }));

        // Reset trạng thái lời mời
        setHasSentRequest(false);
        setHasReceivedRequest(false);
      }
    };

    const handleFriendRemoved = (data) => {
      console.log("🔔 ChatPage - Nhận được sự kiện friend-removed:", {
        eventData: data,
        currentUser: {
          userId: currentUser?.userId,
          contacts: currentUser?.contacts,
        },
        chatUser: {
          userId: chatUser?.userId,
          isFriend: chatUser?.isFriend,
        },
      });

      const isCurrentUserInvolved =
        data.to === currentUser?.userId ||
        data.friendId === currentUser?.userId;

      const isChatUserInvolved =
        data.removerId === chatUser?.userId ||
        data.friendId === chatUser?.userId;

      if (isCurrentUserInvolved || isChatUserInvolved) {
        // Cập nhật trạng thái kết bạn ngay lập tức
        setChatUser((prev) => ({
          ...prev,
          isFriend: false,
        }));

        // Reset trạng thái lời mời
        setHasSentRequest(false);
        setHasReceivedRequest(false);

        // Cập nhật contacts trong currentUser
        setUser((prev) => {
          const updatedContacts =
            prev.contacts?.filter(
              (id) => id !== data.friendId && id !== data.removerId
            ) || [];
          return {
            ...prev,
            contacts: updatedContacts,
          };
        });

        // Kiểm tra lại trạng thái kết bạn từ server
        checkFriendRequestStatus(chatUser?.userId);
      }
    };

    // Đăng ký lắng nghe các sự kiện
    socket.on("friend-request-accepted", handleFriendRequestAccepted);
    socket.on("friend-request-rejected", handleFriendRequestRejected);
    socket.on("friend-removed", handleFriendRemoved);

    return () => {
      console.log("♻️ Cleanup: Hủy đăng ký các listeners");
      socket.off("friend-request-accepted", handleFriendRequestAccepted);
      socket.off("friend-request-rejected", handleFriendRequestRejected);
      socket.off("friend-removed", handleFriendRemoved);
    };
  }, [socket, chatUser?.userId, currentUser?.userId]);

  const handleImageSelect = async (event) => {
    console.log("handleImageSelect được gọi, event:", event);
    console.log("event.target:", event.target);
    console.log("event.target.files:", event.target.files);

    const file = event.target.files[0];
    // Reset giá trị input file sau khi đã lấy file
    event.target.value = null;

    if (!file) {
      console.log("Không có file được chọn");
      return;
    }

    console.log("File được chọn:", file);
    console.log("File name:", file.name);
    console.log("File type:", file.type);
    console.log("File size:", file.size);

    // Kiểm tra kích thước và loại file
    if (file.size > 5 * 1024 * 1024) {
      messageApi.open({
        type: "error",
        content: "Kích thước ảnh không được vượt quá 5MB",
      });
      return;
    }

    if (!file.type.includes("image/")) {
      messageApi.open({
        type: "error",
        content: "Vui lòng chọn file ảnh",
      });
      return;
    }

    // Tạo ID tin nhắn tạm thời
    const tempMessageId = `temp_${Date.now()}`;

    try {
      if (!conversationId) {
        throw new Error("Không tìm thấy cuộc trò chuyện");
      }

      // Tạo tin nhắn tạm thời để hiển thị trạng thái đang tải
      const tempMessage = {
        conversationId,
        senderId: currentUser.userId,
        receiverId: chatUser.userId,
        type: "image",
        content: "Đang tải ảnh...",
        messageId: tempMessageId,
        createdAt: Date.now(),
        status: "sending",
        messageText: newMessage.trim(), // Lưu nội dung tin nhắn kèm theo nếu có
        sender: {
          id: currentUser.userId,
          name: currentUser.fullName,
          avatar: currentUser.avatar,
        },
      };

      // Thêm tin nhắn vào state ngay lập tức
      setMessages((prev) => [...prev, tempMessage]);
      scrollToBottom();

      // Tạo form data để gửi ảnh
      const formData = new FormData();
      formData.append("image", file);
      formData.append("conversationId", conversationId);
      formData.append("fileName", file.name);

      // Thêm messageText vào formData nếu có
      if (newMessage.trim()) {
        formData.append("messageText", newMessage.trim());
      }

      console.log("FormData được tạo:", {
        file: file.name,
        conversationId: conversationId,
        fileName: file.name,
        messageText: newMessage.trim() || "không có",
      });

      // Gửi ảnh lên server
      console.log("Đang gọi API uploadMessageImageApi");
      const response = await uploadMessageImageApi(formData);
      console.log("Upload image response:", response);

      if (response.status) {
        // Kiểm tra xem API đã tự tạo tin nhắn trong database chưa
        if (response.data && response.data.messageId) {
          console.log(
            "Đã tìm thấy messageId từ uploadMessageImageApi:",
            response.data.messageId
          );

          // Đảm bảo metadata có dạng object
          let metadataObj = {};
          try {
            if (typeof response.data.metadata === "string") {
              metadataObj = JSON.parse(response.data.metadata);
            } else if (typeof response.data.metadata === "object") {
              metadataObj = response.data.metadata;
            }
          } catch (e) {
            console.error("Lỗi parse metadata:", e);
          }

          // Cập nhật tin nhắn với thông tin từ server
          const finalMessage = {
            ...response.data,
            content: response.data.url || response.data.content,
            type: "image",
            status: "sent",
            senderId: currentUser.userId,
            receiverId: chatUser.userId,
            metadata: metadataObj,
            sender: {
              id: currentUser.userId,
              name: currentUser.fullName,
              avatar: currentUser.avatar,
            },
          };

          // Cập nhật tin nhắn với thông tin thật từ server
          setMessages((prev) =>
            prev.map((msg) =>
              msg.messageId === tempMessageId ? finalMessage : msg
            )
          );

          // Emit socket event
          socket?.emit("send-message", {
            ...finalMessage,
            conversationId,
            to: chatUser.userId,
          });

          // Reset input message nếu có
          if (newMessage.trim()) {
            setNewMessage("");
          }
        } else {
          // Nếu API không tạo message, chúng ta sẽ tạo
          // Tạo dữ liệu tin nhắn kèm nội dung text nếu có
          const messageData = {
            conversationId,
            senderId: currentUser.userId,
            receiverId: chatUser.userId,
            type: "image",
            content: response.data.url || "",
            metadata: JSON.stringify({
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
              messageText: newMessage.trim(), // Lưu nội dung tin nhắn vào metadata
            }),
          };

          // Gọi API lưu tin nhắn
          const messageResponse = await sendMessageApi(messageData);

          if (messageResponse.status) {
            const finalMessage = {
              ...messageResponse.data,
              content: response.data.url || "",
              type: "image",
              status: "sent",
              senderId: currentUser.userId,
              receiverId: chatUser.userId,
              sender: {
                id: currentUser.userId,
                name: currentUser.fullName,
                avatar: currentUser.avatar,
              },
            };

            // Cập nhật tin nhắn với thông tin thật từ server
            setMessages((prev) =>
              prev.map((msg) =>
                msg.messageId === tempMessageId ? finalMessage : msg
              )
            );

            // Emit socket event
            socket?.emit("send-message", {
              ...finalMessage,
              conversationId,
              to: chatUser.userId,
            });

            // Reset input message nếu có
            if (newMessage.trim()) {
              setNewMessage("");
            }
          } else {
            throw new Error(messageResponse.message || "Gửi tin nhắn thất bại");
          }
        }
      } else {
        throw new Error(response.message || "Gửi ảnh thất bại");
      }
    } catch (error) {
      console.error("Error sending image message:", error);

      // Xóa tin nhắn tạm thời nếu gửi thất bại
      setMessages((prev) =>
        prev.filter((msg) => msg.messageId !== tempMessageId)
      );

      messageApi.open({
        type: "error",
        content: error.message || "Gửi ảnh thất bại",
      });
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop().toLowerCase();

    // Kiểm tra kích thước file
    const isVideoMp4 = fileExt === "mp4" || file.type === "video/mp4";
    const maxVideoSize = 30 * 1024 * 1024; // 30MB cho video MP4
    const maxNormalSize = 10 * 1024 * 1024; // 10MB cho các file khác

    // Áp dụng giới hạn kích thước dựa trên loại file
    const maxSize = isVideoMp4 ? maxVideoSize : maxNormalSize;

    if (file.size > maxSize) {
      messageApi.open({
        type: "error",
        content: `Kích thước file không được vượt quá ${
          isVideoMp4 ? "30MB" : "10MB"
        }`,
      });
      return;
    }

    const tempId = `temp_${Date.now()}`;

    console.log(
      "Uploading file:",
      file.name,
      "type:",
      file.type,
      "size:",
      file.size,
      "extension:",
      fileExt,
      "maxSize:",
      maxSize / (1024 * 1024) + "MB"
    );

    try {
      // Tạo tin nhắn tạm thời để hiển thị trạng thái đang tải
      const tempMessage = {
        messageId: tempId,
        conversationId,
        senderId: currentUser.userId,
        receiverId: chatUser.userId,
        type: "file",
        content: "Đang tải file...",
        fileName: file.name,
        fileSize: file.size,
        createdAt: Date.now(),
        status: "sending",
        sender: {
          id: currentUser.userId,
          name: currentUser.fullName,
          avatar: currentUser.avatar,
        },
      };

      // Thêm tin nhắn tạm thời vào state
      setMessages((prev) => [...prev, tempMessage]);
      scrollToBottom();

      // Tạo form data để gửi file
      const formData = new FormData();
      formData.append("file", file);
      formData.append("conversationId", conversationId);
      formData.append("fileName", file.name); // Thêm tên file để server có thể xử lý dựa trên tên

      // Gửi file lên server
      const response = await uploadMessageFileApi(formData);

      if (response.status) {
        // Tạo dữ liệu tin nhắn
        const messageData = {
          conversationId,
          senderId: currentUser.userId,
          receiverId: chatUser.userId,
          type: "file",
          content: response.data.url,
          metadata: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            fileExt: fileExt,
          }),
        };

        // Gọi API lưu tin nhắn
        const messageResponse = await sendMessageApi(messageData);

        if (messageResponse.status) {
          const finalMessage = {
            ...response.data,
            ...messageResponse.data,
            content: response.data.url,
            type: "file",
            status: "sent",
            senderId: currentUser.userId,
            receiverId: chatUser.userId,
            createdAt: messageResponse.data.createdAt || Date.now(),
            sender: {
              id: currentUser.userId,
              name: currentUser.fullName,
              avatar: currentUser.avatar,
            },
          };

          // Cập nhật tin nhắn với thông tin thật từ server
          setMessages((prev) =>
            prev.map((msg) => (msg.messageId === tempId ? finalMessage : msg))
          );

          // Emit socket event để thông báo tin nhắn mới
          socket?.emit("send-message", {
            ...finalMessage,
            conversationId,
            senderId: currentUser.userId,
            receiverId: chatUser.userId,
            to: chatUser.userId,
          });

          scrollToBottom();
        } else {
          throw new Error(messageResponse.message || "Gửi file thất bại");
        }
      } else {
        throw new Error(response.message || "Gửi file thất bại");
      }
    } catch (error) {
      console.error("Error sending file:", error);
      // Xóa tin nhắn tạm thời nếu gửi thất bại
      setMessages((prev) => prev.filter((msg) => msg.messageId !== tempId));
      messageApi.open({
        type: "error",
        content:
          "Không thể gửi file. Vui lòng thử lại: " + (error.message || ""),
      });
    } finally {
      // Reset input file
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleOpenUserInfo = () => {
    setIsUserInfoModalOpen(true);
  };

  const handleCloseUserInfo = () => {
    setIsUserInfoModalOpen(false);
  };

  // Thêm useEffect mới để cập nhật isFriend khi contacts thay đổi
  useEffect(() => {
    console.log("🔄 ChatPage - contacts hoặc chatUser thay đổi:", {
      contacts: currentUser?.contacts,
      chatUserId: chatUser?.userId,
      currentIsFriend: chatUser?.isFriend,
    });

    if (currentUser?.contacts && chatUser?.userId) {
      const isFriend = currentUser.contacts.includes(chatUser.userId);
      console.log("📊 ChatPage - Kiểm tra trạng thái kết bạn:", {
        oldIsFriend: chatUser?.isFriend,
        newIsFriend: isFriend,
        calculation: {
          contacts: currentUser.contacts,
          chatUserId: chatUser.userId,
          includes: currentUser.contacts.includes(chatUser.userId),
        },
      });

      setChatUser((prev) => {
        const newState = {
          ...prev,
          isFriend,
        };
        console.log("✅ ChatPage - Cập nhật chatUser:", {
          oldState: prev,
          newState,
        });
        return newState;
      });
    }
  }, [currentUser?.contacts, chatUser?.userId]);

  // Thêm useEffect để cập nhật trạng thái hoạt động của chatUser ban đầu
  useEffect(() => {
    // Nếu đã có data của chatUser nhưng chưa có thông tin trạng thái
    if (
      chatUser &&
      (chatUser.isOnline === undefined || chatUser.lastActive === undefined)
    ) {
      // Gọi API để lấy thông tin trạng thái
      const fetchUserStatus = async () => {
        try {
          // Gọi API thật để lấy thông tin trạng thái
          const statusRes = await getUserStatusApi(chatUser.userId);

          if (statusRes.status) {
            setChatUser((prev) => ({
              ...prev,
              isOnline: statusRes.data.isOnline,
              lastActive: statusRes.data.lastActive,
            }));
          } else {
            // Fallback nếu API gặp lỗi
            setChatUser((prev) => ({
              ...prev,
              isOnline: false,
              lastActive: new Date().toISOString(),
            }));
          }
        } catch (error) {
          console.error("Lỗi khi lấy trạng thái người dùng:", error);
          // Fallback trong trường hợp lỗi
          setChatUser((prev) => ({
            ...prev,
            isOnline: false,
            lastActive: new Date().toISOString(),
          }));
        }
      };

      fetchUserStatus();
    }
  }, [chatUser?.userId]);

  // Hàm xử lý thả tim cho tin nhắn - sửa để cập nhật UI tạm thời
  const handleLikeMessage = (messageId) => {
    // Cập nhật UI tạm thời để phản hồi ngay cho người dùng
    // Sẽ được ghi đè bởi socket event sau đó

    // 1. Cập nhật số lượng tim
    setLikedMessages((prev) => {
      const currentCount = prev[messageId] || 0;
      return {
        ...prev,
        [messageId]: currentCount + 1,
      };
    });

    // 2. Cập nhật ngay trạng thái tim của người dùng hiện tại
    setMessageReactions((prev) => {
      // Tạo một bản sao sâu của state hiện tại
      const updated = { ...prev };

      // Nếu chưa có reactions cho tin nhắn này, tạo mới
      if (!updated[messageId]) {
        updated[messageId] = {};
      }

      // Nếu người dùng chưa thả tim, thêm mới với count = 1
      if (!updated[messageId][currentUser.userId]) {
        updated[messageId][currentUser.userId] = {
          type: "heart",
          count: 1,
        };
      }
      // Nếu đã thả tim, tăng count lên
      else {
        updated[messageId][currentUser.userId] = {
          ...updated[messageId][currentUser.userId],
          count: updated[messageId][currentUser.userId].count + 1,
        };
      }

      return updated;
    });

    // Gửi thông tin reaction qua socket
    if (socket && conversationId) {
      socket.emit("react-message", {
        messageId,
        conversationId,
        userId: currentUser.userId,
        type: "heart",
        action: "add",
      });
    }
  };

  const handleOpenReactionModal = async (messageId) => {
    if (messageReactions[messageId]) {
      // Lấy danh sách userId đã thả tim
      const userIds = Object.keys(messageReactions[messageId]);

      // Thiết lập dữ liệu cơ bản cho modal
      setSelectedMessageReactions({
        messageId,
        reactions: messageReactions[messageId],
      });

      setShowReactionModal(true);

      const userDetails = {};

      try {
        // Thử lấy thông tin từ danh bạ hoặc cache trước
        const fetchPromises = userIds.map(async (userId) => {
          // Nếu là người dùng hiện tại, lấy từ currentUser
          if (userId === currentUser?.userId) {
            userDetails[userId] = {
              userId,
              fullName: currentUser.fullName || "Bạn",
              avatar: currentUser.avatar || defaultAvatar,
            };
            return;
          }

          // Nếu là người đang chat với, lấy từ chatUser
          if (userId === chatUser?.userId) {
            userDetails[userId] = {
              userId,
              fullName: chatUser.fullName,
              avatar: chatUser.avatar || defaultAvatar,
            };
            return;
          }

          // Nếu không có trong cache, gọi API
          try {
            const userResponse = await getUserByIdApi(userId);
            if (userResponse.status) {
              userDetails[userId] = {
                userId,
                fullName: userResponse.data.fullName,
                avatar: userResponse.data.avatar || defaultAvatar,
              };
            }
          } catch (error) {
            console.error(
              `Không thể lấy thông tin người dùng ${userId}`,
              error
            );
            // Fallback to basic info
            userDetails[userId] = {
              userId,
              fullName: userId,
              avatar: defaultAvatar,
            };
          }
        });

        // Đợi tất cả các request hoàn thành
        await Promise.all(fetchPromises);

        // Cập nhật state với thông tin chi tiết
        setReactedUserDetails(userDetails);
      } catch (error) {
        console.error("Lỗi khi lấy thông tin người dùng:", error);
      }
    }
  };

  // useEffect để lắng nghe sự kiện typing
  useEffect(() => {
    if (!socket || !conversationId) return;

    // Hàm xử lý khi nhận sự kiện user-typing
    const handleUserTyping = (data) => {
      console.log("Nhận sự kiện typing:", data);
      if (data.userId === chatUser?.userId) {
        setChatUserTyping(true);
      }
    };

    // Hàm xử lý khi nhận sự kiện user-stop-typing
    const handleUserStopTyping = (data) => {
      console.log("Nhận sự kiện stop typing:", data);
      if (data.userId === chatUser?.userId) {
        setChatUserTyping(false);
      }
    };

    // Đăng ký lắng nghe sự kiện
    socket.on("user-typing", handleUserTyping);
    socket.on("user-stop-typing", handleUserStopTyping);

    // Cleanup khi unmount
    return () => {
      socket.off("user-typing", handleUserTyping);
      socket.off("user-stop-typing", handleUserStopTyping);
    };
  }, [socket, conversationId, chatUser?.userId]);

  // Hàm gửi trạng thái typing
  const handleTyping = () => {
    if (!socket || !conversationId || !chatUser?.isFriend) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing", { conversationId });
    }

    // Clear previous timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      setIsTyping(false);
      socket.emit("stop-typing", { conversationId });
    }, 2000); // 2 giây sau khi ngừng gõ

    setTypingTimeout(timeout);
  };

  // Xử lý khi người dùng gõ
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    handleTyping();
  };

  // Hàm xử lý khi chọn emoji
  const handleEmojiSelect = (emoji) => {
    // Thêm emoji vào tin nhắn hiện tại
    setNewMessage((prev) => prev + emoji);
    // Đặt focus lại vào input sau khi chọn emoji
    messageInputRef.current?.focus();
    // Đóng emoji picker sau khi chọn
    setShowEmojiPicker(false);
  };

  // Đóng emoji picker khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showEmojiPicker) {
        // Kiểm tra nếu click ngoài emoji picker và không phải là button mở emoji
        if (
          !event.target.closest(".emoji-picker") &&
          !event.target.closest(".emoji-button")
        ) {
          setShowEmojiPicker(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Xử lý sự kiện paste
  const handlePaste = (e) => {
    const items = e.clipboardData.items;

    // Duyệt qua các item trong clipboard
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        // Lấy file ảnh từ clipboard
        const file = items[i].getAsFile();

        // Tạo tên cho file từ timestamp
        const fileName = `pasted-image-${Date.now()}.png`;
        const renamedFile = new File([file], fileName, { type: file.type });

        // Lưu file vào state để hiển thị preview
        const url = URL.createObjectURL(file);
        setPastedImage({
          previewUrl: url,
          file: renamedFile,
        });

        // Ngăn chặn paste mặc định
        e.preventDefault();
        return;
      }
    }
  };

  // Xóa ảnh đã paste
  const clearPastedImage = () => {
    if (pastedImage && pastedImage.previewUrl) {
      URL.revokeObjectURL(pastedImage.previewUrl);
    }
    setPastedImage(null);
  };

  const handleOpenCreateGroupModal = () => {
    setShowCreateGroupModal(true);
  };

  const handleCloseCreateGroupModal = () => {
    setShowCreateGroupModal(false);
  };

  const handleCreateGroup = async (groupData) => {
    try {
      // Gọi API tạo nhóm đã được thực hiện trong CreateGroupModal
      // và groupData là dữ liệu conversation đã tạo thành công
      console.log("Dữ liệu nhóm:", groupData);

      messageApi.open({
        type: "success",
        content: "Tạo nhóm thành công",
      });

      // Đóng modal tạo nhóm
      handleCloseCreateGroupModal();

      // Chuyển đến cuộc trò chuyện nhóm mới tạo
      if (groupData && groupData.conversationId) {
        // Sử dụng setTimeout để đảm bảo navigate xảy ra sau khi state đã được cập nhật
        setTimeout(() => {
          navigate(`/chat/${groupData.conversationId}`);
        }, 100);
      }
    } catch (error) {
      console.error("Lỗi khi tạo nhóm:", error);
      messageApi.open({
        type: "error",
        content: "Không thể tạo nhóm",
      });
    }
  };

  const handleDeleteMessage = async (message) => {
    try {
      const response = await deleteMessageApi(
        message.messageId,
        conversationId
      );

      if (response.status) {
        // Cập nhật UI local
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === message.messageId
              ? { ...msg, isDeleted: true, content: "Tin nhắn đã được xóa" }
              : msg
          )
        );

        // Emit socket event để thông báo cho người nhận
        if (socket) {
          socket.emit("message-deleted", {
            messageId: message.messageId,
            conversationId,
            senderId: currentUser.userId,
            receiverId: chatUser.userId,
            isDeleted: true,
            content: "Tin nhắn đã được xóa",
          });
        }

        messageApi.open({
          type: "success",
          content: "Đã xóa tin nhắn",
        });
      } else {
        messageApi.open({
          type: "error",
          content: response.message || "Không thể xóa tin nhắn",
        });
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      messageApi.open({
        type: "error",
        content: "Có lỗi xảy ra khi xóa tin nhắn",
      });
    }
  };

  // Thêm socket listener cho sự kiện xóa tin nhắn
  useEffect(() => {
    if (!socket || !conversationId) return;

    const handleMessageDeleted = (data) => {
      console.log("Received message-deleted event:", data);
      if (data.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === data.messageId
              ? { ...msg, isDeleted: true, content: "Tin nhắn đã được xóa" }
              : msg
          )
        );
      }
    };

    // Đăng ký lắng nghe sự kiện message-deleted
    socket.on("message-deleted", handleMessageDeleted);

    return () => {
      socket.off("message-deleted", handleMessageDeleted);
    };
  }, [socket, conversationId]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
      </div>
    );
  }

  if (!chatUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p className="text-gray-500">Không tìm thấy người dùng</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full">
      <div className="flex-1 flex flex-col bg-white">
        <div className="sticky top-0 z-20 px-4 py-3 border-b border-[#00000026] bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={chatUser.avatar || defaultAvatar}
                alt={chatUser.fullName}
                className="w-12 h-12 rounded-full object-cover cursor-pointer"
                onClick={handleOpenUserInfo}
              />
              {/* Chỉ báo trạng thái online */}
              {!chatUser.isGroup &&
                (chatUser.isOnline ? (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white"></div>
                ) : (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-gray-300 rounded-full border-2 border-white"></div>
                ))}
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="text-[18px] font-medium text-[#06132b] select-none">
                {chatUser.fullName}
              </div>
              <div className="flex items-center text-xs text-gray-500 select-none">
                {chatUser.isGroup ? (
                  <span>{chatUser.participants?.length || 0} thành viên</span>
                ) : chatUser.isOnline ? (
                  <span>Đang hoạt động</span>
                ) : chatUser.lastActive ? (
                  <span>
                    {(() => {
                      const lastActive = new Date(chatUser.lastActive);
                      const now = new Date();
                      const diffInMinutes = Math.floor(
                        (now - lastActive) / (1000 * 60)
                      );

                      if (diffInMinutes < 1) return "Vừa truy cập";
                      if (diffInMinutes < 60)
                        return `Truy cập ${diffInMinutes} phút trước`;

                      const diffInHours = Math.floor(diffInMinutes / 60);
                      if (diffInHours < 24)
                        return `Truy cập ${diffInHours} giờ trước`;

                      const diffInDays = Math.floor(diffInHours / 24);
                      return `Truy cập ${diffInDays} ngày trước`;
                    })()}
                  </span>
                ) : (
                  <span>Không hoạt động</span>
                )}
                <span className="ml-2.5 text-gray-200">|</span>
                <div className="flex items-center gap-1 ml-2.5">
                  <PiTagSimple
                    size={17}
                    className="text-[#5a6981] hover:text-blue-600 cursor-pointer transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[#0f182e] text-[18px]">
            <button
              className="hover:bg-gray-100 p-2 rounded cursor-pointer"
              onClick={handleOpenCreateGroupModal}
            >
              <AiOutlineUsergroupAdd size={22} />
            </button>
            <button className="hover:bg-gray-100 p-2 rounded cursor-pointer">
              <HiOutlineVideoCamera size={22} />
            </button>
            <button className="hover:bg-gray-100 p-2 rounded cursor-pointer">
              <IoSearchOutline size={20} />
            </button>
            <button className="hover:bg-gray-100 p-2 rounded cursor-pointer">
              <TbColumns2 size={20} />
            </button>
          </div>
        </div>

        <div className="bg-[#ebecf0] flex-1 overflow-y-auto">
          {!chatUser?.isFriend && !chatUser?.isGroup && (
            <div className="sticky top-[10px] z-10 m-2 px-4 py-3 border-b border-[#00000026] rounded-md bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserAddOutlined />
                <span className="text-sm text-gray-600 select-none">
                  {hasReceivedRequest
                    ? "Người này đã gửi lời mời kết bạn cho bạn"
                    : hasSentRequest
                    ? "Đã gửi lời mời kết bạn"
                    : "Gửi yêu cầu kết bạn tới người này"}
                </span>
              </div>
              {hasReceivedRequest ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleAcceptRequest}
                    disabled={accepting || rejecting}
                    className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
                      accepting
                        ? "bg-[#0068ff] text-white opacity-50 cursor-not-allowed"
                        : "bg-[#0068ff] text-white hover:bg-[#0052cc]"
                    }`}
                  >
                    {accepting ? (
                      <div className="flex items-center gap-1">
                        <Spin
                          indicator={
                            <LoadingOutlined
                              style={{ color: "white", fontSize: 14 }}
                              spin
                            />
                          }
                        />
                        <span>Đồng ý</span>
                      </div>
                    ) : (
                      "Đồng ý"
                    )}
                  </button>
                  <button
                    onClick={handleRejectRequest}
                    disabled={accepting || rejecting}
                    className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
                      rejecting
                        ? "bg-gray-200 text-gray-600 opacity-50 cursor-not-allowed"
                        : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                    }`}
                  >
                    {rejecting ? (
                      <div className="flex items-center gap-1">
                        <Spin
                          indicator={
                            <LoadingOutlined style={{ fontSize: 14 }} spin />
                          }
                        />
                        <span>Từ chối</span>
                      </div>
                    ) : (
                      "Từ chối"
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSendRequest}
                  disabled={sending || hasSentRequest}
                  className={`px-4 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
                    hasSentRequest
                      ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                      : sending
                      ? "bg-[#0068ff] text-white opacity-50 cursor-not-allowed"
                      : "bg-[#0068ff] text-white hover:bg-[#0052cc]"
                  }`}
                >
                  {sending ? (
                    <div className="flex items-center gap-1">
                      <Spin
                        indicator={
                          <LoadingOutlined
                            style={{ color: "white", fontSize: 14 }}
                            spin
                          />
                        }
                      />
                      <span>Gửi kết bạn</span>
                    </div>
                  ) : hasSentRequest ? (
                    <span>Đã gửi</span>
                  ) : (
                    <span>Gửi kết bạn</span>
                  )}
                </button>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 pb-5 pl-3 bg-[#ebecf0]">
            <div className="text-center text-xs text-gray-400">
              {new Date().toLocaleDateString("vi-VN", {
                weekday: "long",
                day: "numeric",
                month: "numeric",
                year: "numeric",
              })}
            </div>

            {messages.map((msg, idx) => {
              // Sửa lại cách xác định người gửi
              const isSender = msg.sender?.id === currentUser?.userId;
              const isFirstMessage = idx === 0;
              const prevMessage = idx > 0 ? messages[idx - 1] : null;
              const showAvatar =
                !isSender &&
                (!prevMessage || prevMessage.sender?.id !== msg.sender?.id);

              // Lấy danh sách người đã thả tim (nếu có)
              const hasReactions = messageReactions[msg.messageId || idx];
              const currentUserHasReacted =
                hasReactions &&
                Object.keys(messageReactions[msg.messageId || idx]).includes(
                  currentUser?.userId
                );

              return (
                <div
                  key={msg.messageId || idx}
                  className={`flex ${
                    isSender ? "justify-end" : "justify-start"
                  } ${
                    !isFirstMessage &&
                    !isSender &&
                    prevMessage?.sender?.id === msg.sender?.id
                      ? "mt-[5.5px] mb-[4px]"
                      : "mt-[5.5px] mb-[4px]"
                  }`}
                >
                  {!isSender && (
                    <div className="w-10 min-w-[40px] mr-2">
                      {(showAvatar || chatUser?.isGroup) && (
                        <img
                          src={msg.sender?.avatar || defaultAvatar}
                          alt={msg.sender?.name || "Thành viên nhóm"}
                          className="w-10 h-10 rounded-full object-cover cursor-pointer"
                          onClick={handleOpenUserInfo}
                        />
                      )}
                    </div>
                  )}

                  <div className="relative group max-w-[60%]">
                    <div
                      className={`relative inline-block border-transparent rounded-[6px] p-3 text-sm ${
                        isSender ? "bg-[#dbebff]" : "bg-white"
                      }`}
                      style={{
                        boxShadow:
                          "0px 0px 1px 0px rgba(21,39,71,0.25), 0px 1px 1px 0px rgba(21,39,71,0.25)",
                        maxWidth: "100%",
                        wordBreak: "break-word",
                      }}
                    >
                      {/* Hiển thị các icon khi hover */}
                      {!msg.isDeleted && (
                        <div
                          className={`absolute bottom-0 hidden group-hover:flex items-center gap-2 rounded-full py-2 px-2 z-10 ${
                            isSender ? "right-full" : "left-full"
                          }`}
                        >
                          <div className="w-6 h-6 flex items-center justify-center bg-[#ffffffcc] rounded-full cursor-pointer">
                            <FaQuoteRight
                              className="text-[#5a6981] hover:text-[#005ae0]"
                              size={10}
                            />
                          </div>
                          <div className="w-6 h-6 flex items-center justify-center bg-[#ffffffcc] rounded-full cursor-pointer">
                            <IoIosShareAlt
                              className="text-[#5a6981] hover:text-[#005ae0]"
                              size={15}
                            />
                          </div>
                          <MessageDropdown
                            message={msg}
                            currentUserId={currentUser.userId}
                            onDelete={handleDeleteMessage}
                          />
                        </div>
                      )}

                      {/* Nội dung tin nhắn */}
                      {msg.isDeleted ? (
                        <div className="italic text-gray-500 select-none">
                          {msg.content}
                        </div>
                      ) : msg.type === "image" ? (
                        msg.status === "sending" ? (
                          <div className="flex items-center gap-2">
                            <Spin
                              indicator={
                                <LoadingOutlined
                                  style={{ fontSize: 16 }}
                                  spin
                                />
                              }
                            />
                            <span>Đang tải ảnh...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <img
                              src={msg.content}
                              alt="Ảnh tin nhắn"
                              className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                              style={{ maxHeight: "150px" }}
                              onClick={() => setSelectedImage(msg.content)}
                            />
                            {/* Hiển thị text đi kèm với ảnh nếu có */}
                            {(() => {
                              let messageText = "";

                              // Kiểm tra nếu tin nhắn có trường messageText trực tiếp
                              if (msg.messageText) {
                                messageText = msg.messageText;
                              }
                              // Nếu không, kiểm tra trong metadata
                              else if (msg.metadata) {
                                try {
                                  // Kiểm tra nếu metadata là string thì parse
                                  if (typeof msg.metadata === "string") {
                                    const metadataObj = JSON.parse(
                                      msg.metadata
                                    );
                                    messageText = metadataObj.messageText || "";
                                  }
                                  // Nếu metadata là object
                                  else if (typeof msg.metadata === "object") {
                                    messageText =
                                      msg.metadata.messageText || "";
                                  }
                                } catch (error) {
                                  console.error(
                                    "Lỗi khi parse metadata:",
                                    error
                                  );
                                }
                              }

                              // Hiển thị messageText nếu có
                              return messageText ? (
                                <div className="mt-1 text-sm">
                                  {messageText}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        )
                      ) : typeof msg.content === "string" &&
                        (msg.content.endsWith(".gif") ||
                          msg.content.endsWith(".jpg") ||
                          msg.content.endsWith(".png") ||
                          msg.content.endsWith(".jpeg")) ? (
                        <img
                          src={msg.content}
                          alt="Ảnh tin nhắn"
                          className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          style={{ maxHeight: "150px" }}
                          onClick={() => setSelectedImage(msg.content)}
                        />
                      ) : msg.type === "file" ? (
                        msg.status === "sending" ? (
                          <div className="flex items-center gap-2">
                            <Spin
                              indicator={
                                <LoadingOutlined
                                  style={{ fontSize: 16 }}
                                  spin
                                />
                              }
                            />
                            <span>Đang tải file...</span>
                          </div>
                        ) : (
                          (() => {
                            const isMP4 = msg.metadata
                              ? (() => {
                                  const metadata = JSON.parse(msg.metadata);
                                  const fileName = metadata.fileName || "";
                                  const fileExt = fileName
                                    .split(".")
                                    .pop()
                                    .toLowerCase();
                                  return (
                                    fileExt === "mp4" ||
                                    metadata.mimeType === "video/mp4"
                                  );
                                })()
                              : (msg.url || msg.content || "")
                                  .toLowerCase()
                                  .endsWith(".mp4");

                            const isMP3 = msg.metadata
                              ? (() => {
                                  const metadata = JSON.parse(msg.metadata);
                                  const fileName = metadata.fileName || "";
                                  const fileExt = fileName
                                    .split(".")
                                    .pop()
                                    .toLowerCase();
                                  return (
                                    fileExt === "mp3" ||
                                    metadata.mimeType === "audio/mpeg" ||
                                    metadata.mimeType === "audio/mp3"
                                  );
                                })()
                              : (msg.url || msg.content || "")
                                  .toLowerCase()
                                  .endsWith(".mp3");

                            if (isMP4) {
                              return (
                                <div className="flex flex-col gap-2 max-w-[360px]">
                                  <video
                                    controls
                                    className="max-w-full rounded-lg cursor-pointer"
                                    style={{ maxHeight: "300px" }}
                                  >
                                    <source
                                      src={msg.url || msg.content}
                                      type="video/mp4"
                                    />
                                    Trình duyệt của bạn không hỗ trợ phát video.
                                  </video>
                                  <div className="flex items-center gap-2 p-2 rounded-lg transition-colors cursor-pointer">
                                    <BsFiletypeMp4
                                      className="text-purple-500"
                                      size={30}
                                    />
                                    <div className="flex flex-col gap-0.5 text-sm text-black font-medium select-none">
                                      <span>
                                        {msg.metadata
                                          ? JSON.parse(msg.metadata).fileName
                                          : "Video.mp4"}
                                      </span>
                                      <span className="text-xs text-gray-500 font-normal">
                                        {msg.metadata
                                          ? (() => {
                                              const fileSize = JSON.parse(
                                                msg.metadata
                                              ).fileSize;
                                              const fileSizeKB =
                                                fileSize / 1024;
                                              if (fileSizeKB < 1024) {
                                                return (
                                                  fileSizeKB.toFixed(2) + " KB"
                                                );
                                              } else {
                                                return (
                                                  (fileSizeKB / 1024).toFixed(
                                                    2
                                                  ) + " MB"
                                                );
                                              }
                                            })()
                                          : ""}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            if (isMP3) {
                              return (
                                <div className="flex flex-col gap-2 max-w-[360px]">
                                  <audio
                                    controls
                                    className="max-w-full rounded-lg"
                                  >
                                    <source
                                      src={msg.url || msg.content}
                                      type="audio/mpeg"
                                    />
                                    Trình duyệt của bạn không hỗ trợ phát âm
                                    thanh.
                                  </audio>
                                  <div className="flex items-center gap-2 p-2 rounded-lg transition-colors cursor-pointer">
                                    <BsFiletypeMp3
                                      className="text-purple-500"
                                      size={30}
                                    />
                                    <div className="flex flex-col gap-0.5 text-sm text-black font-medium select-none">
                                      <span>
                                        {msg.metadata
                                          ? JSON.parse(msg.metadata).fileName
                                          : "Audio.mp3"}
                                      </span>
                                      <span className="text-xs text-gray-500 font-normal">
                                        {msg.metadata
                                          ? (() => {
                                              const fileSize = JSON.parse(
                                                msg.metadata
                                              ).fileSize;
                                              const fileSizeKB =
                                                fileSize / 1024;
                                              if (fileSizeKB < 1024) {
                                                return (
                                                  fileSizeKB.toFixed(2) + " KB"
                                                );
                                              } else {
                                                return (
                                                  (fileSizeKB / 1024).toFixed(
                                                    2
                                                  ) + " MB"
                                                );
                                              }
                                            })()
                                          : ""}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <a
                                href={msg.url || msg.content}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                              >
                                {msg.metadata &&
                                  (() => {
                                    const metadata = JSON.parse(msg.metadata);
                                    const fileName = metadata.fileName || "";
                                    const fileExt = fileName
                                      .split(".")
                                      .pop()
                                      .toLowerCase();

                                    if (fileExt === "pdf") {
                                      return (
                                        <FaFilePdf
                                          className="text-red-500"
                                          size={24}
                                        />
                                      );
                                    } else if (
                                      fileExt === "xlsx" ||
                                      fileExt === "xls"
                                    ) {
                                      return (
                                        <FaFileExcel
                                          className="text-green-600"
                                          size={24}
                                        />
                                      );
                                    } else if (
                                      fileExt === "pptx" ||
                                      fileExt === "ppt"
                                    ) {
                                      return (
                                        <FaFilePowerpoint
                                          className="text-orange-600"
                                          size={24}
                                        />
                                      );
                                    } else if (
                                      fileExt === "docx" ||
                                      fileExt === "doc"
                                    ) {
                                      return (
                                        <FaFileWord
                                          className="text-blue-500"
                                          size={24}
                                        />
                                      );
                                    } else if (
                                      [
                                        "js",
                                        "ts",
                                        "jsx",
                                        "tsx",
                                        "html",
                                        "css",
                                        "json",
                                      ].includes(fileExt)
                                    ) {
                                      return (
                                        <FaFileCode
                                          className="text-purple-500"
                                          size={24}
                                        />
                                      );
                                    } else if (fileExt === "csv") {
                                      return (
                                        <FaFileCsv
                                          className="text-green-600"
                                          size={24}
                                        />
                                      );
                                    } else if (fileExt === "txt") {
                                      return (
                                        <BsFiletypeTxt
                                          className="text-blue-500"
                                          size={24}
                                        />
                                      );
                                    } else if (
                                      fileExt === "zip" ||
                                      fileExt === "rar"
                                    ) {
                                      return (
                                        <FaFileArchive
                                          className={`${
                                            fileExt === "zip"
                                              ? "text-yellow-600"
                                              : "text-purple-500"
                                          }`}
                                          size={24}
                                        />
                                      );
                                    } else {
                                      return (
                                        <FaFile
                                          className="text-gray-500"
                                          size={24}
                                        />
                                      );
                                    }
                                  })()}
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {msg.metadata
                                      ? JSON.parse(msg.metadata).fileName
                                      : "File"}
                                  </span>
                                  <span className="text-xs text-gray-500 mt-0.5">
                                    {msg.metadata
                                      ? (() => {
                                          const fileSize = JSON.parse(
                                            msg.metadata
                                          ).fileSize;
                                          // Chuyển đổi sang KB
                                          const fileSizeKB = fileSize / 1024;

                                          // Nếu nhỏ hơn 1MB (1024KB)
                                          if (fileSizeKB < 1024) {
                                            return (
                                              fileSizeKB.toFixed(2) + " KB"
                                            );
                                          }
                                          // Nếu lớn hơn hoặc bằng 1MB
                                          else {
                                            return (
                                              (fileSizeKB / 1024).toFixed(2) +
                                              " MB"
                                            );
                                          }
                                        })()
                                      : ""}
                                  </span>
                                </div>
                              </a>
                            );
                          })()
                        )
                      ) : (
                        <div className="flex flex-col">
                          {!isSender && chatUser?.isGroup && (
                            <span className="text-[11px] text-[#707c8f] select-none cursor-pointer">
                              {msg.sender?.name}
                            </span>
                          )}
                          <span className="text-sm text-[#081b3a]">
                            {msg.content}
                          </span>
                        </div>
                      )}

                      <div className="text-xs text-[#44546f] font-[400] mt-1 select-none">
                        {msg.createdAt
                          ? new Date(msg.createdAt).toLocaleTimeString(
                              "vi-VN",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "Vừa gửi"}
                      </div>
                    </div>

                    {/* Icon thả tim */}
                    {!msg.isDeleted && (
                      <div
                        className={`absolute -bottom-3 -right-0 z-10 hover:scale-110 transition-all duration-300 ${
                          likedMessages[msg.messageId || idx]
                            ? "flex"
                            : "hidden group-hover:flex"
                        }`}
                      >
                        <div
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-white shadow-md cursor-pointer hover:bg-gray-100"
                          onClick={() =>
                            handleLikeMessage(msg.messageId || idx)
                          }
                        >
                          {currentUserHasReacted ? (
                            <AiFillHeart className="text-red-500" size={19} />
                          ) : (
                            <HeartOutlined className="text-red-500" />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Hiển thị số lượng tim đã được thả */}
                    {likedMessages[msg.messageId || idx] && (
                      <div
                        className="absolute -bottom-3 right-7 p-0.5 bg-white shadow-lg rounded-xl flex items-center cursor-pointer z-5"
                        onClick={() =>
                          handleOpenReactionModal(msg.messageId || idx)
                        }
                      >
                        <AiFillHeart className="text-red-500" size={19} />
                        <span className="text-xs select-none">
                          {likedMessages[msg.messageId || idx]}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={bottomRef}></div>
          </div>
        </div>

        {chatUserTyping ? (
          <span className="text-black-500 text-sm bg-[#ebecf0] pl-3">
            <span className="animate-pulse">
              {chatUser.fullName} đang nhập...
            </span>
          </span>
        ) : null}

        <div className="border-t border-[#00000026] bg-white">
          <div className="border-t border-[#00000026] flex items-center gap-2 px-2 text-[#0f182e]">
            <button
              className={`hover:bg-gray-100 p-2 rounded cursor-pointer ${
                !chatUser?.isFriend &&
                !chatUser?.isGroup &&
                "opacity-50 cursor-not-allowed"
              }`}
              disabled={!chatUser?.isFriend && !chatUser?.isGroup}
            >
              <LuSticker size={23} />
            </button>
            <button
              className={`hover:bg-gray-100 p-2 rounded cursor-pointer ${
                !chatUser?.isFriend &&
                !chatUser?.isGroup &&
                "opacity-50 cursor-not-allowed"
              }`}
              onClick={() => {
                if (chatUser?.isFriend || chatUser?.isGroup) {
                  console.log("Nút chọn ảnh được click");
                  if (imageInputRef.current) {
                    console.log("Mở hộp thoại chọn file");
                    imageInputRef.current.click();
                  } else {
                    console.log("imageInputRef.current là null");
                  }
                }
              }}
              disabled={!chatUser?.isFriend && !chatUser?.isGroup}
            >
              <FaRegImage size={20} />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  console.log("onChange của input file được kích hoạt");
                  handleImageSelect(e);
                }}
                className="hidden"
              />
            </button>
            <button
              className={`hover:bg-gray-100 p-2 rounded cursor-pointer ${
                !chatUser?.isFriend &&
                !chatUser?.isGroup &&
                "opacity-50 cursor-not-allowed"
              }`}
              onClick={() =>
                (chatUser?.isFriend || chatUser?.isGroup) &&
                fileInputRef.current?.click()
              }
              disabled={!chatUser?.isFriend && !chatUser?.isGroup}
            >
              <GoPaperclip size={20} />
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
              />
            </button>
            <button
              className={`hover:bg-gray-100 p-2 rounded cursor-pointer ${
                !chatUser?.isFriend &&
                !chatUser?.isGroup &&
                "opacity-50 cursor-not-allowed"
              }`}
              disabled={!chatUser?.isFriend && !chatUser?.isGroup}
            >
              <RiMoreLine size={23} />
            </button>
          </div>

          <div className="p-2 border-t border-[#00000026] bg-white flex items-center gap-1">
            <input
              ref={messageInputRef}
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              disabled={!chatUser?.isFriend && !chatUser?.isGroup}
              className="flex-1 px-3 py-[6px] rounded-full outline-none text-md text-[#081b3a] placeholder:text-[#647187] disabled:cursor-not-allowed"
              placeholder={
                chatUser?.isFriend || chatUser?.isGroup
                  ? `Nhập @, tin nhắn tới ${chatUser.fullName}`
                  : "Hãy kết bạn để nhắn tin"
              }
            />

            <div className="relative">
              <button
                className={`emoji-button text-[#081b3a] text-lg hover:bg-gray-100 p-1 rounded-full cursor-pointer ${
                  !chatUser?.isFriend &&
                  !chatUser?.isGroup &&
                  "opacity-50 cursor-not-allowed"
                }`}
                disabled={!chatUser?.isFriend && !chatUser?.isGroup}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <PiSmiley size={24} />
              </button>

              {showEmojiPicker && (
                <EmojiPicker onSelectEmoji={handleEmojiSelect} />
              )}
            </div>

            {(chatUser?.isFriend || chatUser?.isGroup) &&
              (newMessage.trim() === "" && !pastedImage ? (
                <button
                  onClick={handleSendLike}
                  className="text-[#081b3a] text-lg hover:bg-gray-100 p-1 rounded-full cursor-pointer"
                >
                  <AiFillLike size={24} color="#f8ca67" />
                </button>
              ) : (
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() && !pastedImage}
                  className={`text-blue-600 hover:bg-blue-50 p-2 rounded-full cursor-pointer ${
                    !newMessage.trim() &&
                    !pastedImage &&
                    "opacity-50 cursor-not-allowed"
                  }`}
                >
                  <IoSend size={20} />
                </button>
              ))}
          </div>

          {/* Hiển thị xem trước ảnh nếu có */}
          {pastedImage && (
            <div className="relative px-4 pt-3 border-t border-[#00000026] bg-white">
              <div className="relative inline-block max-w-[140px] rounded-lg overflow-hidden border border-gray-200">
                <img
                  src={pastedImage.previewUrl}
                  alt="Pasted"
                  className="max-h-[140px] object-contain cursor-pointer"
                  onClick={() => setSelectedImage(pastedImage.previewUrl)}
                />
                <button
                  className="absolute top-1 right-1 cursor-pointer bg-gray-800 bg-opacity-70 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-opacity-100"
                  onClick={clearPastedImage}
                >
                  <CloseOutlined />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ReactionModal
        isOpen={showReactionModal}
        onClose={() => setShowReactionModal(false)}
        data={selectedMessageReactions}
        userDetails={reactedUserDetails}
      />

      <ImageViewModal
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        imageUrl={selectedImage}
      />

      <UserInfoModal
        isOpen={isUserInfoModalOpen}
        onClose={handleCloseUserInfo}
        userData={chatUser}
      />

      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={handleCloseCreateGroupModal}
        onCreateGroup={handleCreateGroup}
      />
    </div>
  );
};

export default ChatPage;
