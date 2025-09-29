//メインのJS

let currentCategory=null;
let currentThread=null;
let currentUserId=null;
let currentUsername=null;

let currentPartnerId=null;

//ページ切り替え処理
document.querySelectorAll("nav a").forEach(a=>{
    a.addEventListener("click",e=>{
        e.preventDefault();
        const text=a.textContent.trim();

        //ログイン必須ページならチェックを入れる
        const needLogin=(text==="BBS"||text==="チャット"||text==="マイプロフィール");
        if(needLogin&&!localStorage.getItem("userId")){
            alert("ログインが必要です");
            switchView("login");
            return;
        }

        document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));

        if(text==="ホーム"){
            document.getElementById("home").classList.add("active");
        }
        if(text==="BBS"){
            document.getElementById("bbs").classList.add("active");

            //カテゴリ、スレッドをリセット
            currentCategory=null;
            currentThread=null;

            //ローカルストレージからユーザー情報を再同期
            const uid=localStorage.getItem("userId");
            const uname=localStorage.getItem("username");
            if(uid){
                currentUserId=uid.toString();
            }
            if(uname){
                currentUsername=uname;
            }
            loadSidebar();//最新状態に毎回更新
        }
        if(text==="チャット"){
            document.getElementById("chat").classList.add("active");
            loadChatUsers();
        }
        if(text==="マイプロフィール"){
            document.getElementById("profile").classList.add("active");

            //ログインしているユーザーの情報を取得して表示
            const uid=localStorage.getItem("userId");
            if(!uid){
                alert("ログインが必要です");
                switchView("login");
                return;
            }

            fetch(`/api/users/${uid}`)
            .then(res=>res.json())
            .then(user=>{
                document.getElementById("profileId").textContent=user.id;
                document.getElementById("profileUsername").textContent=user.username;
                document.getElementById("profileEmail").textContent=user.email;
                document.getElementById("profilePassword").textContent=user.password_hash;

                //イベントを付与
                const renameUsernameBtn=document.getElementById("renameUsernameBtn");
                if(renameUsernameBtn){
                    attachRenameUsername(renameUsernameBtn);
                }
                const renameEmailBtn=document.getElementById("renameEmailBtn");
                if(renameEmailBtn){
                    attachRenameEmail(renameEmailBtn);
                }
                const renamePasswordBtn=document.getElementById("renamePasswordBtn");
                if(renamePasswordBtn){
                    attachRenamePassword(renamePasswordBtn);
                }
            })
            .catch(err=>{
                console.error(err);
                alert("プロフィール情報を取得できませんでした");
            });
        }
    });
});

// メッセージの描画
async function loadMessages(categoryName,threadName){
    currentCategory=categoryName;
    currentThread=threadName;

    //必ず同期
    const uid=localStorage.getItem("userId");
    const uname=localStorage.getItem("username");
    if(uid){
        currentUserId=uid.toString();
    }
    if(uname){
        currentUsername=uname;
    }

    //見出しを更新
    const header=document.querySelector(".thread-header"); 
    header.textContent=`${categoryName}>>${threadName}`;

    //メッセージ一覧をクリア
    const messagesEl=document.querySelector(".messages");
    messagesEl.innerHTML="";

    //入力欄の要素を取得
    const inputArea=document.querySelector(".input-area");

    if(!categoryName||!threadName){
        if(inputArea){
            inputArea.style.display="none";
            return;
        }
    }

    try{
        //APIからメッセージを取得
        const cat=encodeURIComponent(categoryName);
        const th=encodeURIComponent(threadName);
        const res=await fetch(`/api/${cat}/${th}/messages`);
        if(!res.ok){
            throw new Error("メッセージ取得に失敗しました");
        }
        const messages=await res.json();

        for(const msg of messages){
            const bubble=document.createElement("div");
            bubble.className="bubble";

            //自分の投稿かどうかで左右切り替え
            if(msg.user_id&&msg.user_id.toString()===currentUserId){
                bubble.classList.add("right");
                
            }else{
                bubble.classList.add("left");
            }

            //ユーザー名ラベル
            const nameDiv=document.createElement("div");
            nameDiv.className="username";
            nameDiv.textContent=msg.username?msg.username:"名無し";

            //本文
            const textDiv=document.createElement("div");
            textDiv.textContent=msg.text;

            //時刻など
            const metaDiv=document.createElement("div");
            metaDiv.className="meta";
            metaDiv.textContent=`${msg.user_id ? "ユーザー"+msg.user_id : "名無し"}・${new Date(msg.time).toLocaleString()}`;

            //組み立て
            bubble.appendChild(nameDiv);
            bubble.appendChild(textDiv);
            bubble.appendChild(metaDiv);

            messagesEl.appendChild(bubble);
        }
        //ユーザーIDを記録
        lastRenderedUserId=currentUserId;

        //一番下にスクロール
        setTimeout(()=>{
            messagesEl.scrollTop=messagesEl.scrollHeight;
        })

        //取得が成功したら入力欄を表示
        if(inputArea){
            inputArea.style.display="flex";
        }
    }catch(err){
        console.error(err);
        messagesEl.textContent="メッセージ読み込み中にエラーが発生しました";
        if(inputArea){
            inputArea.style.display="none";
        }
    }
}

//init関数
let __inited=false;
function initApp(){
    if(__inited){
        return;
    }
    __inited=true;

    const header=document.querySelector(".thread-header");
    const form=document.querySelector(".input-area");
    const textarea=form.querySelector("textarea");

    //初期ヘッダー
    header.textContent="スレッドを選択してください";

    //入力欄の高さの自動調整
    textarea.addEventListener("input",()=>autoResize(textarea));

    //Ctrl＋Enterで送信するコード
    textarea.addEventListener("keydown",(e)=>{
        if(e.key==="Enter"&&e.ctrlKey){
            e.preventDefault();
            sendMessage(textarea);
        }
    });
    //送信ボタン押下で送信
    form.addEventListener("submit",(e)=>{
        e.preventDefault();
        sendMessage(textarea);
    });

    //各種ボタンにイベントを付与
    //新規追加ボタン
    document.querySelectorAll(".add-thread-button")
    .forEach(attachThreadButtonEvent);
    //削除ボタン
    document.querySelectorAll(".delete-category-button")
    .forEach(btn=>attachDeleteEvent(btn,"category"));
    document.querySelectorAll(".delete-thread-button")
    .forEach(btn=>attachDeleteEvent(btn,"thread"));
    //リネームボタン
    document.querySelectorAll(".rename-category-button")
    .forEach(btn=>attachRenameCategory(btn));
    document.querySelectorAll(".rename-thread-button")
    .forEach(btn=>attachRenameThread(btn));

}

//ページ読み込み時に初期化
document.addEventListener("DOMContentLoaded",()=>{
    const userId=localStorage.getItem("userId");
    const username=localStorage.getItem("username");

    if(userId&&username){
        currentUserId=userId.toString();
        currentUsername=username;

        //既にログイン済みならホーム画面へ
        switchView("home");
        initApp();
    }else{
        //ログインしていないならログイン画面へ
        switchView("login");
    }
});

//画面切り替え関数
function switchView(viewId){
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    const target=document.getElementById(viewId);
    if(target){
        target.classList.add("active");
    }
}

 
//入力欄の高さ調整関数
function autoResize(textarea){
    const baseHeight=16;
    if(textarea.value===""){
        textarea.style.height="1rem";
    }else{
        textarea.style.height="auto";
        textarea.style.height=Math.max(textarea.scrollHeight,baseHeight)+"px";
    }  
}
    

//メッセージ送信関数
let posting=false;
async function sendMessage(textarea){
    if(!currentCategory||!currentThread){
        return;
    }
    const text =textarea.value.trim();
    if(text===""){
        return;
    }

    const userId=localStorage.getItem("userId");
    const username=localStorage.getItem("username");

    posting=true;

    try{
        const cat=encodeURIComponent(currentCategory);
        const th=encodeURIComponent(currentThread);

        await fetch(`/api/${cat}/${th}/messages`,{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({text,user_id:userId})
        });

        //テキストエリアをクリア
        textarea.value="";
        autoResize(textarea);

        //サーバーから再ロード
        await loadMessages(currentCategory,currentThread);

        //再描画後にスクロール
        const messagesEl=document.querySelector(".messages");
        if(messagesEl){
            setTimeout(()=>{
                messagesEl.scrollTop=messagesEl.scrollHeight;
        })
        }

    }catch(err){
        console.error("送信エラー：",err);
    }finally{
        posting=false;
    }
}

//自動スクロール関数
function scrollToBottom(messages){
    requestAnimationFrame(()=>{
        const last = messages.lastElementChild;
        if (last) last.scrollIntoView({ block: "end", behavior: "auto" });
        messages.scrollTop = messages.scrollHeight;//保険
    });
}

//スレッドをクリックしたときの動作
document.querySelector(".sidebar").addEventListener("click",(e)=>{
    if(e.target.tagName==="A"&&e.target.closest(".thread-list")){
        e.preventDefault();
        const details=e.target.closest("details");
        const categoryName=details.querySelector(".category-label").textContent.trim();
        const threadName=e.target.textContent.trim();

        activateThread(e.target,categoryName,threadName);
    }
});

//スレッドを追加した時の処理
function attachThreadButtonEvent(btn){
    btn.addEventListener("click",(e)=>{
        e.stopPropagation();
        handleAddThreadClick(e);
    });
}

//サイドバーを再描画
async function loadSidebar(){
    const sidebar=document.querySelector("#bbs .sidebar");
    if(!sidebar){
        return;
    }

    //既存のdetailsを全部消す（「＋カテゴリ追加」ボタンは残す）
    sidebar.querySelectorAll("details").forEach(d=>d.remove());

    try{
        //カテゴリ一覧
        const res=await fetch("/api/categories");
        const categories=await res.json();
        for(const cat of categories){
            //DOM生成
            const details=createCategoryElement(cat);
            sidebar.appendChild(details);

            //ボタンにイベント付与
            //新規追加ボタン
            const addBtn=details.querySelector(".add-thread-button");
            if(addBtn){
                attachThreadButtonEvent(addBtn);
            }
            //削除ボタン
            const delBtn=details.querySelector(".delete-category-button");
            if(delBtn){
                attachDeleteEvent(delBtn,"category");
            }
            //リネームボタン
            const renameCatBtn=details.querySelector(".rename-category-button");
            if(renameCatBtn){
            attachRenameCategory(renameCatBtn);
            }

            //スレッド一覧を取得して挿入
            const ul=details.querySelector(".thread-list");
            try{
                const catEnc=encodeURIComponent(cat);
                const resTh=await fetch(`/api/${catEnc}/threads`);
                //存在しないカテゴリだと404扱いになる仕様なので、その時は空扱い
                if(resTh.ok){
                    const threads=await resTh.json();
                    for(const th of threads){
                        const li=createThreadElement(th);
                        ul.appendChild(li);
                        const a=li.querySelector("a");
                        const del=li.querySelector(".delete-thread-button");
                        if(del){
                            attachDeleteEvent(del,"thread");
                        }
                        //リネームボタン
                        const renameThreadBtn=li.querySelector(".rename-thread-button");
                        if(renameThreadBtn){
                        attachRenameThread(renameThreadBtn);
                        }
                    }
                }
            }catch(e){
                console.error("スレッド取得エラー：",e);
            }
        }
    }catch(e){
        console.error("カテゴリ取得エラー：",e);
    }
}

//チャットのメッセージ送信関数
async function sendChatMessage(textarea,partnerId){
    const text =textarea.value.trim();
    if(text===""){
        return;
    }

    const myId=localStorage.getItem("userId");

    try{
        const res=await fetch(`/api/chat/${partnerId}/messages`,{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({text,sender_id:myId})
        });

        if(!res.ok){
            throw new Error("送信失敗");
        }

        //サーバーが返したメッセージデータを即描画
        const msg=await res.json();
        console.log("送信直後のレスポンス:", msg);
        appendChatMessage(msg,myId,msg.receiver_name);

        //ここでヘッダー更新
        const chatHeader=document.getElementById("chatHeader");
        chatHeader.textContent=`ユーザー${msg.receiver_id}${msg.receiver_name}との会話`;

        //テキストエリアをクリア
        textarea.value="";
        autoResize(textarea);

        //サーバーから再ロード
        await loadChatMessages(partnerId,msg.receiver_name);
    }catch(err){
        console.error("送信エラー：",err);
    }
}

//送信直後の描画用ヘルパー関数
function appendChatMessage(msg,myId,partnerName){
    const messagesEl=document.getElementById("chatMessages");

    const bubble=document.createElement("div");
    bubble.className="bubble";
    bubble.classList.add(msg.sender_id.toString()===myId?"right":"left");

    const nameDiv=document.createElement("div");
    nameDiv.className="username";
    nameDiv.textContent=msg.sender_id.toString()===myId
    ?(msg.sender_name||"自分")
    :(partnerName||msg.receiver_name||"相手");

    const textDiv=document.createElement("div");
    textDiv.textContent=msg.text;

    const metaDiv=document.createElement("div");
    metaDiv.className="meta";
    metaDiv.textContent=new Date(msg.time).toLocaleString();

    bubble.appendChild(nameDiv);
    bubble.appendChild(textDiv);
    bubble.appendChild(metaDiv);

    messagesEl.appendChild(bubble);

    //一番下にスクロール
    setTimeout(()=>{
        messagesEl.scrollTop=messagesEl.scrollHeight;
    })
}

//チャットフォームのイベント追加
const chatForm=document.getElementById("chatForm");
const chatTextarea=document.getElementById("chatInput");

chatTextarea.addEventListener("input",()=>autoResize(chatTextarea));

chatTextarea.addEventListener("keydown",(e)=>{
    if(e.key==="Enter"&&e.ctrlKey){
            e.preventDefault();
            sendChatMessage(chatTextarea,currentPartnerId);
    }
});

chatForm.addEventListener("submit",(e)=>{
    e.preventDefault();
    sendChatMessage(chatTextarea,currentPartnerId);
});

//チャットメッセージの描画
async function loadChatMessages(partnerId,partnerName){
    currentPartnerId=partnerId;

    //必ず同期
    const myId=Number(localStorage.getItem("userId"));

    //見出しを更新
    const chatHeader=document.getElementById("chatHeader"); 
    chatHeader.textContent=`ユーザー${partnerId}${partnerName}との会話`;

    //メッセージ一覧をクリア
    const messagesEl=document.getElementById("chatMessages");
    messagesEl.innerHTML="";

    try{
        //APIからメッセージを取得
        const res=await fetch(`/api/chat/${partnerId}/messages?myId=${myId}`);
        if(!res.ok){
            throw new Error("チャットメッセージ取得に失敗しました");
        }
        const messages=await res.json();

        for(const msg of messages){
            const bubble=document.createElement("div");
            bubble.className="bubble";

            //自分の投稿かどうかで左右切り替え
            if(Number(msg.sender_id)===myId){
                bubble.classList.add("right");
                
            }else{
                bubble.classList.add("left");
            }

            //ユーザー名ラベル
            const nameDiv=document.createElement("div");
            nameDiv.className="username";
            if(Number(msg.sender_id)===myId){
                nameDiv.textContent=msg.sender_name||"自分";
            }else{
                nameDiv.textContent=msg.sender_name||"相手";
            }

            //本文
            const textDiv=document.createElement("div");
            textDiv.textContent=msg.text;

            //時刻など
            const metaDiv=document.createElement("div");
            metaDiv.className="meta";
            metaDiv.textContent=new Date(msg.time).toLocaleString();

            //組み立て
            bubble.appendChild(nameDiv);
            bubble.appendChild(textDiv);
            bubble.appendChild(metaDiv);

            messagesEl.appendChild(bubble);
        }
        //一番下にスクロール
        setTimeout(()=>{
            messagesEl.scrollTop=messagesEl.scrollHeight;
        })

        //取得が成功したら入力欄を表示
        document.getElementById("chatForm").style.display="flex";
    }catch(err){
        console.error(err);
        messagesEl.textContent="チャット読み込み中にエラーが発生しました";
        document.getElementById("chatForm").style.display="none";
    }
}

//チャットユーザー一覧を読み込み、クリックで会話を展開
async function loadChatUsers(){
    const myId=localStorage.getItem("userId");
    const userList=document.getElementById("chatUserList"); 
    userList.innerHTML="";

    try{
        const res=await fetch(`/api/users?myId=${myId}`);
        if(!res.ok){
            throw new Error("ユーザー一覧の取得に失敗しました");
        }
        const users=await res.json();

        for(const user of users){
            const li=document.createElement("li");
            li.textContent=user.username;
            li.dataset.id=user.id;

            li.addEventListener("click",()=>{
                loadChatMessages(user.id,user.username);
            });

            userList.appendChild(li);
        }
    }catch(err){
        console.error(err);
        userList.textContent="ユーザー一覧を読み込めませんでした";
    }
}