//index.js

const express=require('express');
const path=require('path');
const fs=require("fs");
const { error } = require('console');
const DATA_FILE=path.join(__dirname,"data.json");
const db=require("./db");

const app=express();
const PORT=process.env.PORT||3000;

//JSONを吸う
app.use(express.json());

//publicを静的配信
app.use(express.static(path.join(__dirname,'..','public')));

// 仮のメモリ上データ
let data = {}; 
if(fs.existsSync(DATA_FILE)){
    try{
        const raw=fs.readFileSync(DATA_FILE,"utf-8");
        data=JSON.parse(raw);
    }catch(e){
        console.error("JSON読み込みエラー：",e);
        data={};
    }
}

//データセーブ関数
function saveData(){
    fs.writeFileSync(DATA_FILE,JSON.stringify(data,null,2),"utf-8");
}

// チャット機能
//特定ユーザーとの会話履歴を取得
app.get('/api/chat/:partnerId/messages',async(req,res)=>{
    const myId=req.query.myId;
    const partnerId=req.params.partnerId;

    try{
        const[rows]=await db.query(
            `SELECT dm.id, dm.sender_id, dm.receiver_id, dm.text, dm.time,
             su.username AS sender_name,
             ru.username AS receiver_name
             FROM direct_messages dm 
             JOIN users su ON dm.sender_id=su.id 
             JOIN users ru ON dm.receiver_id=ru.id 
             WHERE (dm.sender_id = ? AND dm.receiver_id=?) 
                OR (dm.sender_id = ? AND dm.receiver_id=?) 
             ORDER BY dm.time ASC`
            ,[myId,partnerId,partnerId,myId]);

            console.log("SQL結果:", rows);

        res.json(rows);
    }catch(err){
        console.error(err);
        res.status(500).json({error:'DBエラー'});
    }
});

//メッセージ送信
app.post('/api/chat/:partnerId/messages',async(req,res)=>{
    const myId=req.body.sender_id;
    const partnerId=req.params.partnerId;
    const text=req.body.text;

    if(!text){
        return res.status(400).json({error:'メッセージが空です'});
    }

    try{
        const[result]=await db.query(
            `INSERT INTO direct_messages (sender_id,receiver_id, text, time)
             VALUES (?, ?, ?, NOW())`,
            [myId,partnerId,text]
        );

        //自分の名前
        const[[sender]]=await db.query(
            'SELECT username FROM users WHERE id = ?',
            [myId]
        );

        //相手の名前
        const[[receiver]]=await db.query(
            'SELECT username FROM users WHERE id = ?',
            [partnerId]
        );

        res.status(201).json({
            id:result.insertId,
            sender_id:myId,
            receiver_id:partnerId,
            text,
            time:new Date().toISOString(),
            sender_name:sender?sender.username:"名無し",
            receiver_name:receiver?receiver.username:"名無し"
        });
    }catch(err){
        console.error(err);
        res.status(500).json({error:'DBエラー'});
    }
});

//チャットサイドバーに全ユーザーを表示
app.get('/api/users',async(req,res)=>{
    const myId=req.query.myId;
    try{
        let sql='SELECT id, username FROM users';
        let params=[];
        if(myId){
            sql+=' WHERE id <> ?';
            params.push(myId);
        }
        const [rows]=await db.query(sql,params);
        res.json(rows);
    }catch(err){
        console.error(err);
        res.status(500).json({error:'DBエラー'});
    }
});

// BBS
//カテゴリ一覧を返す
app.get('/api/categories',async(req,res)=>{
    try{
        const[rows]=await db.query('SELECT name FROM categories ORDER BY id ASC');
        res.json(rows.map(r=>r.name));
    }catch(err){
        console.error(err);
        res.status(500).json({error:'DBエラー'});
    }
});

//新しいカテゴリを作成
app.post('/api/categories',async(req,res)=>{
    const{name}=req.body;
    if(!name){
        return res.status(400).json({error:'カテゴリ名は必須です'});
    }

    try{
        await db.query('INSERT INTO categories (name) VALUES (?)',[name]);
        res.status(201).json({name});
    }catch(err){
        if(err.code==='ER_DUP_ENTRY'){
            return res.status(400).json({error:'既に存在します'});
        }
        console.error(err);
        res.status(500).json({error:'DBエラー'});
    }
});

//スレッド一覧を返す
app.get('/api/:category/threads',async(req,res)=>{
    const{category}=req.params;
    try{
        const[[cat]]=await db.query(
            'SELECT id FROM categories WHERE name=?',
            [category]);
        if(!cat){
            return res.status(404).json({error:'カテゴリが存在しません'});
        }
        const[rows]=await db.query(
            'SELECT name FROM threads WHERE category_id = ? ORDER BY id ASC',
            [cat.id]
        );
        res.json(rows.map(r=>r.name));
    }catch(err){
        console.error(err);
        res.status(500).json({error:'DBエラー'});
    }
});

//新しいスレッドを作成
app.post('/api/:category/threads',async(req,res)=>{
    const{category}=req.params;
    const{name}=req.body;
    if(!name){
        return res.status(400).json({error:'スレッド名は必須です'});
    }
    try{
        const[[cat]]=await db.query(
            'SELECT id FROM categories WHERE name=?',
            [category]);
        if(!cat){
            return res.status(404).json({error:'カテゴリが存在しません'});
        }
        await db.query(
            'INSERT INTO threads (category_id, name) VALUES (?, ?)',
            [cat.id,name]);
        res.status(201).json({name});
    }catch(err){
        if(err.code==='ER_DUP_ENTRY'){
            return res.status(400).json({error:'既に存在します'});
        }
        console.error(err);
        res.status(500).json({error:'DBエラー'});
    }
});

//カテゴリ削除
app.delete('/api/categories/:category',async(req,res)=>{
    const {category}=req.params;
    try{
        const[result]=await db.query(
            'DELETE FROM categories WHERE name = ?',
            [category]);
        if(result.affectedRows==0){
            return res.status(404).json({error:'カテゴリが存在しません'});
        }
        res.json({message:'カテゴリを削除しました'});
    }catch(err){
        console.error(err);
        res.status(500).json({error:'DBエラー'});
    }    
});

//スレッド削除
app.delete('/api/:category/threads/:thread',async(req,res)=>{
    const category=decodeURIComponent(req.params.category);
    const thread=decodeURIComponent(req.params.thread);
    try{
        const[[cat]]=await db.query('SELECT id FROM categories WHERE name=?',[category]);
        if(!cat){
            return res.status(404).json({error:'カテゴリが存在しません'});
        }
        const[result]=await db.query(
            'DELETE FROM threads WHERE category_id = ? AND name = ?',
            [cat.id,thread]
        );
        if(result.affectedRows==0){
            return res.status(404).json({error:'スレッドが存在しません'});
        }
        res.json({message:'スレッドを削除しました'});
    }catch(err){
        console.error(err);
        res.status(500).json({error:'DBエラー'});
    }    
});

//カテゴリ名変更
app.put('/api/categories/:oldName',async(req,res)=>{
    const{oldName}=req.params;
    const{newName}=req.body;
    try{
        const[result]=await db.query(
            'UPDATE categories SET name=? WHERE name=?',
            [newName,oldName]
        );
        if(result.affectedRows===0){
            return res.status(404).json({error:"カテゴリが存在しません"});
        }
        res.json({message:"カテゴリ名を変更しました"});
    }catch(err){
        console.error(err);
        res.status(500).json({error:"DBエラー"});
    }
});

//スレッド名変更
app.put('/api/:category/threads/:oldThread',async(req,res)=>{
    const category=decodeURIComponent(req.params.category);
    const oldThread=decodeURIComponent(req.params.oldThread);
    const{newThread}=req.body;

    // ログ追加（デバッグ用）
    console.log("スレッド名変更リクエスト:", {
        category,
        oldThread,
        newThread
    });

    try{
        const[[cat]]=await db.query(
            'SELECT id FROM categories WHERE name=?',
            [category]
        );
        if(!cat){
            return res.status(404).json({error:"カテゴリが存在しません"});
        }
        const[result]=await db.query(
            'UPDATE threads SET name=? WHERE category_id=? AND name=?',
            [newThread,cat.id,oldThread]
        );
        if(result.affectedRows===0){
            return res.status(404).json({error:"スレッドが存在しません"});
        }
        res.json({message:"スレッド名を変更しました"});
    }catch(err){
        console.error(err);
        res.status(500).json({error:"DBエラー"});
    }
});

//メッセージ一覧を返す
app.get('/api/:category/:thread/messages',async(req,res)=>{
    const category=decodeURIComponent(req.params.category);
    const thread=decodeURIComponent(req.params.thread);

    try{
        //カテゴリ確認
        const[[cat]]=await db.query(
            'SELECT id FROM categories WHERE name= ?',
            [category]
        );
        if(!cat){
            return res.status(404).json({error:'カテゴリが存在しません'});
        }

        //スレッド確認
        const[[th]]=await db.query(
            'SELECT id FROM threads WHERE category_id = ? AND name = ?',
            [cat.id,thread]
        );
        if(!th){
            return res.status(404).json({error:'スレッドが存在しません'});
        }

        //メッセージ取得+ユーザー名結合
        const[rows]=await db.query(
            `SELECT m.id, m.user_id, u.username, m.text, m.time
             FROM messages m 
             LEFT JOIN users u ON m.user_id=u.id 
             WHERE m.thread_id = ? 
             ORDER BY id ASC`
            ,[th.id]);

        res.json(rows);
    }catch(err){
        console.error(err);
        res.status(500).json({error:'DBエラー'});
    }
});    

//新しいメッセージを投稿
app.post('/api/:category/:thread/messages',async(req,res)=>{
    const category=decodeURIComponent(req.params.category);
    const thread=decodeURIComponent(req.params.thread);
    const {user_id,text}=req.body;

    if(!text){
        return res.status(400).json({error:'textは必須です'});
    }

    try{
        //カテゴリ確認
        const[[cat]]=await db.query(
            'SELECT id FROM categories WHERE name= ?',
            [category]
        );
        if(!cat){
            return res.status(404).json({error:'カテゴリが存在しません'});
        }

        //スレッド確認
        const[[th]]=await db.query(
            'SELECT id FROM threads WHERE category_id = ? AND name = ?',
            [cat.id,thread]
        );
        if(!th){
            return res.status(404).json({error:'スレッドが存在しません'});
        }

        //INSERT
        const[result]=await db.query(
            'INSERT INTO messages (thread_id, user_id, text, time) VALUES (?, ?, ?, NOW())',
            [th.id,user_id||null,text]
        );
        res.status(201).json({
            id:result.insertId,
            user_id:user_id||null,
            text,
            time:new Date().toISOString()
        });
    }catch(err){
        console.error(err);
        res.status(500).json({error:'DBエラー'});
    }
});

//ユーザー登録
app.post('/api/register',async(req,res)=>{
    const{username,email,password}=req.body;
    if(!username||!email||!password){
        return res.status(400).json({error:'全ての項目は必須です'});
    }

    try{
        //既存ユーザー確認
        const[rows]=await db.query(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username,email]
        );
        if(rows.length>0){
            return res.status(400).json({error:'ユーザー名、またはメールアドレスは既に存在します'});
        }

        //新規登録
        const[result]=await db.query(
            'INSERT INTO users (username, email, password_hash) VALUES(?, ?, ?)',
            [username,email,password]
        );

        res.status(201).json({userId:result.insertId,username});
    }catch(err){
        console.error(err);
        res.status(500).json({error:'DBエラー'});
    }
});

//ログイン
app.post('/api/login',async(req,res)=>{
    const{username,password}=req.body;
    if(!username||!password){
        return res.status(400).json({error:'ユーザー名とパスワードは必須です'});
    }

    try{
        //既存ユーザー確認
        const[rows]=await db.query(
            'SELECT id, username FROM users WHERE username = ? AND password_hash = ?',
            [username,password]
        );

        if(rows.length===0){
            //認証失敗
            return res.status(401).json({error:'ユーザー名、またはパスワードが違います'});
        }

        //認証成功
        res.json({userId:rows[0].id,username:rows[0].username});
    }catch(err){
        console.error(err);
        res.status(500).json({error:'DBエラー'});
    }
});

//ユーザー情報取得
app.get('/api/users/:id',async(req,res)=>{
    const{id}=req.params;

    try{
        const[rows]=await db.query(
            'SELECT id, username, email, password_hash FROM users WHERE id = ?',
            [id]
        );

        if(rows.length===0){
            return res.status(401).json({error:'ユーザーが存在しません'});
        }
        res.json(rows[0]);
    }catch(err){
        console.error(err);
        res.status(500).json({error:'DBエラー'});
    }
});

//ユーザー名のリネーム
app.put('/api/users/:id/username',async(req,res)=>{
    const{id}=req.params;
    const{username}=req.body;
    if(!username){
        return res.status(400).json({error:"ユーザー名は必須です"});
    }
    try{
        const[result]=await db.query(
            'UPDATE users SET username=? WHERE id=?',
            [username,id]
        );
        if(result.affectedRows===0){
            return res.status(404).json({error:"ユーザーが存在しません"});
        }
        res.json({message:"ユーザー名を変更しました"});
    }catch(err){
        console.error(err);
        res.status(500).json({error:"DBエラー"});
    }
});

//メールアドレスのリネーム
app.put('/api/users/:id/email',async(req,res)=>{
    const{id}=req.params;
    const{email}=req.body;
    if(!email){
        return res.status(400).json({error:"メールアドレスは必須です"});
    }
    try{
        const[result]=await db.query(
            'UPDATE users SET email=? WHERE id=?',
            [email,id]
        );
        if(result.affectedRows===0){
            return res.status(404).json({error:"ユーザーが存在しません"});
        }
        res.json({message:"メールアドレスを変更しました"});
    }catch(err){
        console.error(err);
        res.status(500).json({error:"DBエラー"});
    }
});

//パスワードのリネーム
app.put('/api/users/:id/password',async(req,res)=>{
    const{id}=req.params;
    const{password}=req.body;
    if(!password){
        return res.status(400).json({error:"パスワードは必須です"});
    }
    try{
        const[result]=await db.query(
            'UPDATE users SET password_hash=? WHERE id=?',
            [password,id]
        );
        if(result.affectedRows===0){
            return res.status(404).json({error:"ユーザーが存在しません"});
        }
        res.json({message:"パスワードを変更しました"});
    }catch(err){
        console.error(err);
        res.status(500).json({error:"DBエラー"});
    }
});

//MySQLにあるメッセージを取得
app.get('/api/db-messages',async(req,res)=>{
    try{
        const[rows]=await db.query('SELECT * FROM messages');
        res.json(rows);
    }catch(err){
        res.status(500).json({error:'DBエラー'});
    }
});

app.listen(PORT,()=>{
    console.log(`Server running:http://localhost:${PORT}`);
});