const steps = [
  {
    thought:
      "好的，我已经创建了任务列表。现在我需要启动微信。我可以在屏幕上看到微信图标，位于右上角，是绿色图标，标签为微信。我应该点击它来打开微信。",
    action: 'do(action="Launch", app="微信")',
  },
  {
    thought:
      "很好，微信已经成功打开。我可以看到聊天列表，其中有多个会话。屏幕顶部显示微信 68，表示有 68 个聊天。\n\n我可以看到几个聊天窗口：\n1. 白小泽，14:00，显示 111\n2. Madder，6月4日，显示 I've accepted your friend request. Now let's...\n3. 春和景明、白小泽、Madder，14:24，是一个群聊\n4. 腾讯新闻，13:59\n5. 春和景明，6月25日，显示视频\n6. 孙翊铭，6月25日\n7. 振飞，6月4日\n8. · · ·，6月4日\n9. 服务通知，5月18日\n10. 微信团队，5月12日\n\n现在我需要点击第一个聊天窗口白小泽来打开它。",
    action: 'do(action="Tap", element=[499,131])',
  },
  {
    thought:
      "很好，我已经成功打开了与白小泽的第一个聊天窗口。我可以看到聊天界面，其中有一条 14:00 发送的消息 111。现在我需要在这个聊天中发送一条 fuck you 消息。\n\n我可以看到屏幕底部的输入区域。需要先点击输入框，然后输入消息。让我先点击输入区域。\n\n从屏幕底部来看，那里有一个输入区域。我应该点击它来激活键盘和输入框。",
    action: 'do(action="Tap", element=[499,912])',
  },
  {
    thought:
      "我可以看到输入框现在已经激活，底部输入区域中有光标。我还可以看到屏幕底部显示 ADB Keyboard ON，这说明键盘已经激活。现在我可以输入消息 fuck you。",
    action: 'do(action="Type", text="fuck you")',
  },
  {
    thought:
      "我可以看到 fuck you 已经输入到屏幕底部的输入框里。我还可以看到右侧有一个绿色的发送按钮。现在我需要点击发送按钮来发送这条消息。",
    action: 'do(action="Tap", element=[907,893])',
  },
  {
    thought:
      "很好，我已经成功在与白小泽的第一个聊天中发送了消息 fuck you。我可以看到这条消息现在显示在聊天窗口中，右侧绿色气泡显示 fuck you，时间为 14:27。\n\n现在我需要回到聊天列表，并打开第二个聊天窗口。我应该点击返回按钮返回聊天列表。",
    action: 'do(action="Back")',
  },
  {
    thought:
      "很好，现在我回到了聊天列表。我可以看到屏幕顶部显示微信 68，表示有 68 个聊天。我可以看到第一个聊天是白小泽，并显示我刚刚发送的消息 fuck you，时间为 14:27。\n\n现在我需要点击第二个聊天窗口，也就是 Madder。列表中可以看到它，预览消息为 I've accepted your friend request. Now let's...",
    action: 'do(action="Tap", element=[499,209])',
  },
  {
    thought:
      "好的，我已经打开了第二个聊天窗口，这是与 Madder 的聊天。我可以看到之前的聊天记录，包括一条来自白小泽的消息，时间为 6月4日 13:09，以及一条我已接受你的好友请求。现在让我聊天！的消息，时间为 6月4日 20:52。\n\n现在我需要在这个聊天窗口中发送一条 fuck you 消息。我需要点击输入框，然后输入文字。让我点击底部的输入区域。",
    action: 'do(action="Tap", element=[499,912])',
  },
  {
    thought:
      "好的，我看到输入框已经激活了，底部显示 ADB Keyboard ON，说明键盘已经激活。现在我需要输入 fuck you 这条消息。",
    action: 'do(action="Type", text="fuck you")',
  },
  {
    thought:
      "好的，我已经输入了 fuck you 这条消息，我可以看到输入框中显示了 fuck you，并且右侧有一个绿色的发送按钮。现在我需要点击发送按钮来发送这条消息。",
    action: 'do(action="Tap", element=[907,893])',
  },
  {
    thought:
      "完美，我已经成功在第二个聊天窗口 Madder 中发送了 fuck you 消息。我可以看到消息已经显示在聊天记录中，时间戳为 14:28。\n\n现在我已经完成了任务：\n1. 打开了微信\n2. 在第一个聊天窗口白小泽中发送了 fuck you\n3. 在第二个聊天窗口 Madder 中发送了 fuck you\n\n任务完成。",
    action: 'finish(message="任务完成")',
  },
];

const video = document.querySelector("#demo-video");
const stepNumber = document.querySelector("#step-number");
const stepTime = document.querySelector("#step-time");
const stepThought = document.querySelector("#step-thought");
const stepAction = document.querySelector("#step-action");
const progressFill = document.querySelector("#progress-fill");

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";
  const total = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const rest = String(total % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function setStep(index) {
  const step = steps[Math.max(0, Math.min(index, steps.length - 1))];
  stepNumber.textContent = `Step ${String(index + 1).padStart(2, "0")}`;
  stepThought.textContent = step.thought;
  stepAction.textContent = step.action;
}

function sync() {
  const duration = video.duration;
  const current = video.currentTime;
  stepTime.textContent = formatTime(current);

  if (!Number.isFinite(duration) || duration <= 0) {
    setStep(0);
    return;
  }

  const progress = Math.min(current / duration, 1);
  const index = Math.min(steps.length - 1, Math.floor(progress * steps.length));
  progressFill.style.width = `${progress * 100}%`;
  setStep(index);
}

video.addEventListener("loadedmetadata", sync);
video.addEventListener("timeupdate", sync);
video.addEventListener("seeked", sync);

setStep(0);
