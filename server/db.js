//db.js

const mysql=require('mysql2/promise');

const pool=mysql.createPool({
    host:'localhost',
    user:'mybbs_user',
    password:'任意のパスワード',
    database:'mybbs_app',
    waitForConnections:true,
    connectionLimit:10,
    queueLimit:0
});

//起動時に一度だけ接続確認
(async()=>{
    try{
        const conn=await pool.getConnection();
        console.log('MySQL接続成功（pool）');
        conn.release();
    }catch(err){
        console.error('MySQL接続失敗：',err);
    }
})();

module.exports=pool;