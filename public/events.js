//追加、削除などのイベントのJS


//入力フォーム表示関数
function showNewForm(parent,type,categoryName){
    const wrapper=type==="category"?createNewCategoryForm():createNewThreadForm();
    parent.appendChild(wrapper);

    const input=wrapper.querySelector(type==="category"?".new-category-input":".new-thread-input");
    const button=wrapper.querySelector(type==="category"?".create-category-button":".create-thread-button");

    button.addEventListener("click",()=>createEntity(input,wrapper,parent,type));
    input.addEventListener("keydown",(ev)=>{
        if(ev.key==="Enter"){
            createEntity(input,wrapper,parent,type);
        }
    });
    input.focus();
}

//カテゴリ、スレッドの作成処理の共通化関数
async function createEntity(input,wrapper,parent,type){
    const name=input.value.trim();
    if(!name){
        return;
    }

    try{
        if(type==="category"){
            const res=await fetch("/api/categories",{
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({name})
            });
            if(!res.ok){
                const err=await res.json().catch(()=>({}));
                alert(err.error||"カテゴリ作成に失敗しました");
                return;
            }
            //DOM追加
            const details=createCategoryElement(name);
            parent.insertBefore(details,wrapper);
            //イベント付与
            //新規追加ボタン
            const addBtn=details.querySelector(".add-thread-button");
            if(addBtn){
                attachThreadButtonEvent(addBtn);
            }
            //削除ボタン
            const del=details.querySelector(".delete-category-button");
            if(del){
                attachDeleteEvent(del,"category");
            }
            //リネームボタン
            const rename=details.querySelector(".rename-category-button");
            if(rename){
                attachRenameCategory(rename);
            }
        }else if(type==="thread"){
            const categoryName=parent.dataset.category;
            const catEnc=encodeURIComponent(categoryName);

            //APIでスレッド作成
            const res=await fetch(`/api/${catEnc}/threads`,{
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({name})
            });
            if(!res.ok){
                const err=await res.json().catch(()=>({}));
                alert(err.error||"スレッド作成に失敗しました");
                return;
            }

            //DOM追加
            const threadLi=createThreadElement(name);
            parent.insertBefore(threadLi,wrapper);

            //イベント付与
            const a=threadLi.querySelector("a");
            if(a){
                a.addEventListener("click",(ev)=>{
                    ev.preventDefault();
                    activateThread(a,categoryName,name);
                });
            }
            //削除ボタン
            const del=threadLi.querySelector(".delete-thread-button");        
            if(del){
                attachDeleteEvent(del,"thread");
            }
            //リネームボタン
            const rename=threadLi.querySelector(".rename-thread-button");
            if(rename){
                attachRenameThread(rename);
            }

            //追加直後に開く
            document.querySelectorAll(".thread-list a").forEach(l=>l.classList.remove("active"));
            a.classList.add("active");
            a.click();
        }
    }catch(e){
        console.error("作成エラー：",e);
        alert("通信エラーが発生しました");
        return;
    }finally{
        wrapper.remove();
    }
}

let lastRenderedUserId=null;

//スレッドをアクティブにしてメッセージを読み込む関数
function activateThread(a,categoryName,threadName){
    //毎回ユーザー同期
    const uid = localStorage.getItem("userId");
    if (uid) currentUserId = uid.toString();

    const sameThread=(currentCategory===categoryName&&currentThread===threadName);
    const sameUser=(lastRenderedUserId===currentUserId);

    if(sameThread&&sameUser){
        return;
    }
    document.querySelectorAll(".thread-list a").forEach(l=>l.classList.remove("active"));
    a.classList.add("active");
    loadMessages(categoryName,threadName);
}

//削除関数共通化
function attachDeleteEvent(btn,type){
    btn.addEventListener("click",async(e)=>{
        e.stopPropagation();
        const el=e.target.closest(type==="category"?"details":"li");
        const categoryName=el.closest("details").querySelector(".category-label").textContent.trim();
        const entityName=type==="category"?categoryName:el.querySelector("a").textContent.trim();

        if(!confirm(`${entityName}${type==="category"?"カテゴリ":"スレッド"}を削除しますか？`)){
            return;
        }
        try{
            if(type==="category"){
                const catEnc=encodeURIComponent(categoryName);
                const res=await fetch(`/api/categories/${catEnc}`,{method:"DELETE"});
                if(!res.ok){
                    const err=await res.json().catch(()=>({}));
                    alert(err.error||"カテゴリ削除に失敗しました");
                    return;
                }
            }
            if(type==="thread"){
                const catEnc=encodeURIComponent(categoryName);
                const thEnc=encodeURIComponent(entityName);
                const res=await fetch(`/api/${catEnc}/threads/${thEnc}`,{method:"DELETE"});
                if(!res.ok){
                    const err=await res.json().catch(()=>({}));
                    alert(err.error||"スレッド削除に失敗しました");
                    return;
                }
            }

            //DOMから削除
            el.remove();

            //表示中ならリセット
            if(currentCategory===categoryName&&
                (type==="category"||currentThread===entityName)){
                currentCategory=null;
                currentThread=null;
                loadMessages(null,null);
                document.querySelectorAll(".thread-list a").forEach(l=>l.classList.remove("active"));
            }
        }catch(err){
            console.error("削除エラー：",err);
            alert("通信エラーが発生しました");  
        }
    });
}

//新規カテゴリ追加メソッド
const addCatBtn=document.querySelector(".add-category-button");
if(addCatBtn){
    addCatBtn.addEventListener("click",()=>{
        const sidebar=document.querySelector(".sidebar");

        if(sidebar.querySelector(".new-category-form")){
            return;
        }
        showNewForm(sidebar,"category");
    });
}

//新規スレッド追加メソッド
function handleAddThreadClick(e){
    e.stopPropagation();//detailsの開閉とのバッティング防止
    e.preventDefault();
    const details=e.target.closest("details");
    details.open=true;//強制展開
    const list=details.querySelector(".thread-list");
    const categoryName=list.dataset.category;

    if(list.querySelector(".new-thread-form")){
        return;
    }
    showNewForm(list,"thread",categoryName);
}

//インライン編集共通関数
function startInlineRename(el,oldValue,onSave){
    const input=document.createElement("input");
    input.type="text";
    input.value=oldValue;
    input.className="inline-edit";

    el.replaceWith(input);
    input.focus();

    //二重発火防止
    let committed=false;

    function save(){
        if(committed){
            return;
        }
        committed=true;

        const newValue=input.value.trim();
        if(newValue&&newValue!==oldValue){
            onSave(newValue);
        }else{
            input.replaceWith(el);
        }
    }

    function cancel(){
        if(committed){
            return;
        }
        committed=true;
        input.replaceWith(el);
    }

    //Enterで保存、Escでキャンセル
    input.addEventListener("keydown",(e)=>{
        if(e.key==="Enter"){
            e.preventDefault();
            save();
        }
        if(e.key==="Escape"){
            cancel();
        }
    });
    //フォーカスが外れたら保存
    input.addEventListener("blur",save);
}

//カテゴリリネームイベント
function attachRenameCategory(btn){
    btn.addEventListener("click",async(e)=>{
        e.stopPropagation();
        const details=e.target.closest("details");
        const label=details.querySelector(".category-label");
        const oldName=label.textContent.trim();

        startInlineRename(label,oldName,async(newName)=>{
            const res=await fetch(`/api/categories/${encodeURIComponent(oldName)}`,{
                method:"PUT",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({newName})
            });

            if(res.ok){
                loadSidebar();//再描画
            }else{
                const err=await res.json().catch(()=>({}));
                alert(err.error||"カテゴリ名の変更に失敗しました");
                label.textContent=oldName;//元に戻す
            }
        });
    });
}

//スレッドリネームイベント
function attachRenameThread(btn){
    btn.addEventListener("click",async(e)=>{
        e.stopPropagation();
        const li=e.target.closest("li");
        const a=li.querySelector("a");
        const oldThread=a.textContent.trim();
        const categoryName=li.closest("details").querySelector(".category-label").textContent.trim();

        startInlineRename(a,oldThread,async(newThread)=>{
            // ここでログ出力
            console.log("Rename fetch:", {
                categoryName,
                oldThread,
                newThread
            });

            const res=await fetch(`/api/${encodeURIComponent(categoryName)}/threads/${encodeURIComponent(oldThread)}`,{
                method:"PUT",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({newThread})
            });

            if(res.ok){
                currentThread=newThread;
                a.textContent=newThread;
                await loadSidebar();//再描画
                await loadMessages(categoryName,newThread);
            }else{
                const err=await res.json().catch(()=>({}));
                alert(err.error||"スレッド名の変更に失敗しました");
                a.textContent=oldThread;//元に戻す
            }
        });
    });
}

//ログイン処理
document.getElementById("loginForm").addEventListener("submit",async(e)=>{
    e.preventDefault();

    const username=document.getElementById("loginUsername").value.trim();
    const password=document.getElementById("loginPassword").value.trim();

    try{
        const res=await fetch('/api/login',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({username,password})
        });
        const data=await res.json();
        if(!res.ok){
            alert(data.error||"ログインに失敗しました");
            return;
        }

        //保存して次からは自動ログイン
        localStorage.setItem("userId",data.userId);
        localStorage.setItem("username",data.username);

        //グローバルにもキャッシュ
        currentUserId=data.userId.toString();
        currentUsername=data.username;

        alert("ログイン成功！");

        //画面切り替えと初期化
        switchView("home");
        initApp();

        //ログイン画面を非表示にする
        document.getElementById("login").style.display="none";

        //ログアウトボタンを表示
        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) {
            logoutBtn.style.setProperty("display", "inline-block", "important");
        }
        
    }catch(err){
        console.error("ログインエラー：",err);
        alert("通信エラー");
    }
});

//新規登録処理
document.getElementById("registerForm").addEventListener("submit",async(e)=>{
    e.preventDefault();

    const username=document.getElementById("registerUsername").value.trim();
    const email=document.getElementById("registerEmail").value.trim();
    const password=document.getElementById("registerPassword").value.trim();

    try{
        const res=await fetch('/api/register',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({username,email,password})
        });

        const data=await res.json();
        if(!res.ok){
            alert(data.error||"登録に失敗しました");
            return;
        }

        alert("登録成功！ログインしてください。");

    }catch(err){
        console.error("登録エラー：",err);
        alert("通信エラー");
    }
});

//ログアウト処理
document.getElementById("logoutBtn").addEventListener("click",()=>{
    //ローカルストレージのユーザー情報を削除
    localStorage.removeItem("userId");
    localStorage.removeItem("username");

    alert("ログアウトしました");

    //強制リロード
    location.reload();
});

//ページ読み込み時にログイン状態を確認してログアウトボタンを出す。
window.addEventListener("DOMContentLoaded",()=>{
    const logoutBtn=document.getElementById("logoutBtn");
    if(logoutBtn){
        if(localStorage.getItem("userId")){
            //既にログインしている時ボタンを表示
            logoutBtn.style.setProperty("display","inline-block","important");
        }else{
            //未ログイン時は非表示
            logoutBtn.style.display="none";
        }
    }
});

//ユーザー名リネームイベント
function attachRenameUsername(btn){
    btn.addEventListener("click",()=>{
        const span=document.getElementById("profileUsername");
        const userId=localStorage.getItem("userId");
        const oldValue=span.textContent.trim();

        startInlineRename(span,span.textContent.trim(),async(newValue)=>{
            const res=await fetch(`/api/users/${userId}/username`,{
                method:"PUT",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({username:newValue})
            });

            if(res.ok){
                span.textContent=newValue;
                localStorage.setItem("username",newValue);
                currentUsername=newValue;

                document.querySelectorAll(".message-username").forEach(el=>{
                    if(el.textContent.trim()===oldValue){
                        el.textContent=newValue;
                    }
                });

                if(currentCategory&&currentThread){
                    loadMessages(currentCategory,currentThread);
                }
            }else{
                const err=await res.json().catch(()=>({}));
                alert(err.error||"ユーザー名の変更に失敗しました");
                span.textContent=localStorage.getItem("username");
            }
            //入力欄をspanに戻す
            const input=document.querySelector(".inline-edit");
            if(input){
                input.replaceWith(span);
            }
        });
    });  
}

//メールアドレスリネームイベント
function attachRenameEmail(btn){
    btn.addEventListener("click",()=>{
        const span=document.getElementById("profileEmail");
        const userId=localStorage.getItem("userId");

        startInlineRename(span,span.textContent.trim(),async(newValue)=>{

            //メールアドレス専用の制限
            const regex=/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
            if(!regex.test(newValue)){
                alert("正しいメールアドレス形式で記入してください");
                //入力欄を閉じて元の表示に戻す
                const input=document.querySelector(".inline-edit");
                if(input){
                    input.replaceWith(span);
                }
                return;
            }

            const res=await fetch(`/api/users/${userId}/email`,{
                method:"PUT",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({email:newValue})
            });

            if(res.ok){
                span.textContent=newValue;
                localStorage.setItem("email",newValue);
            }else{
                const err=await res.json().catch(()=>({}));
                alert(err.error||"メールアドレスの変更に失敗しました");
                span.textContent=localStorage.getItem("email");
            }
            //入力欄をspanに戻す
            const input=document.querySelector(".inline-edit");
            if(input){
                input.replaceWith(span);
            }
        });
    });  
}

//パスワードリネームイベント
function attachRenamePassword(btn){
    btn.addEventListener("click",()=>{
        const span=document.getElementById("profilePassword");
        const userId=localStorage.getItem("userId");

        startInlineRename(span,span.textContent.trim(),async(newValue)=>{

            //半角英数字・記号のみ、2文字以上の制限
            const regex=/^[\x21-\x7E]{2,}$/;
            if(!regex.test(newValue)){
                alert("パスワードは半角英数字と記号のみ、2文字以上で入力してください");
                return;
            } 
            const res=await fetch(`/api/users/${userId}/password`,{
                method:"PUT",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({password:newValue})
            });

            if(res.ok){
                span.textContent=newValue;
                localStorage.setItem("password",newValue);
            }else{
                const err=await res.json().catch(()=>({}));
                alert(err.error||"パスワードの変更に失敗しました");
                span.textContent=localStorage.getItem("password");
            }
            //入力欄をspanに戻す
            const input=document.querySelector(".inline-edit");
            if(input){
                input.replaceWith(span);
            }
        });
    });  
}