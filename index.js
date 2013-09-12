require('shelljs/global');
var path = require('path');
var fmt = require('util').format;
var LogClass = require('log');
var logger = new LogClass('info');

//覆盖logger的方法
logger.log = function(levelStr, args) {
  if (LogClass[levelStr] <= this.level) {
    var msg = fmt.apply(null, args);
    this.stream.write(
        '[' + formatDate(new Date(), 'hh:mm:ss') + ']'
      + ' ' + levelStr
      + ' ' + msg
      + '\n'
    );
  }
};

//设置log level
exports.setLogLevel = function(levelStr){
  logger.level = LogClass[levelStr.toUpperCase()];
}

/**
 * 压缩html目录
 * @param  {String} archive 压缩文件名称
 * @param  {String} src     要压缩的目录
 */
exports.zip = function(archive, src, options){
  archive = getAbsolutePath(archive);
  src = getAbsolutePath(src);
  logger.info('zip dir: %s to %s', src, archive);
  if(!test('-e', src)){
    logger.error('src dir not exist: %s',  src);
    return false;
  }else{
    cd(src);
    rm('-f', archive);
    var cmd = formatStr('/7za a -tzip {0} -r ./*', archive);
    // logger.info('>start zip: ' + cmd);
    exec(getToolPath() + cmd, options);
    return true;
  }
}
// exports.zip('../html-dev.zip','D:\\Workspace\\Code\\9game\\ninegameclient\\apad-h5\\dist\\dev\\');

/**
 * 解压zip
 * @param  {String} archive zip文件路径
 * @param  {String} dest    解压目录
 * @param  {Boolean} remove  是否先删除目标目录,默认为false
 */
exports.unzip = function(archive, dest, remove, options){
  archive = getAbsolutePath(archive);
  dest = getAbsolutePath(dest);
  logger.info('unzip zip: %s to %s', archive, dest);
  if(!test('-e', archive)){
    logger.error('archive not exist: %s',  archive);
    return false;
  }else{
    if(remove){
      rm('-rf', dest);
    }
    var cmd = formatStr('/7za x {0} -o{1}', archive, dest);
    //logger.debug('>start unzip: ' + cmd);
    exec(getToolPath() + cmd, options);
    return true;
  }
}
// exports.unzip('D:\\Workspace\\Code\\9game\\ninegameclient\\apad-h5\\dist\\html-dev.zip', 'D:\\Workspace\\Code\\9game\\ninegameclient\\apad-h5\\dist\\html-dev');

/**
 * 把apk解包成目录
 * @param  {String} apk  apk路径
 * @param  {String} dest 解压的目录(会自动加上apk名称)
 */
exports.unpack = function(apk, dest, options){
  apk = getAbsolutePath(apk);
  if(!test('-e', apk) || path.extname(apk)!='.apk'){
    logger.error('apk not exist or not .apk file: %s', apk);
    return false;
  }else{
    var base = path.basename(apk, '.apk');
    dest = getAbsolutePath(path.join(dest, base));
    mkdir('-p', dest);
    rm('-rf', dest);
    var cmd = formatStr('java -jar apktool.jar d -r -s -f {0} {1}', apk, dest);
    logger.info('>start unpack: ' + cmd);
    cd(getToolPath());
    exec(cmd, options);
    return true;
  }
}
// exports.unpack('D:\\Workspace\\Code\\9game\\ninegameclient\\apad-h5\\tools\\cn.ninegame.gamemanager.apk','D:\\Workspace\\Code\\9game\\ninegameclient\\apad-h5\\dist\\');

/**
 * 把目录打包为apk
 * @param  {String} apk  apk路径
 * @param  {String} src  要打包的目录
 */
exports.pack = function(apk, src, options){
  apk = getAbsolutePath(apk);
  src = getAbsolutePath(src);
  if(!test('-d', src)){
    logger.error('src not exist or directory: %s', src);
    return false;
  }else{
    var cmd = formatStr('java -jar apktool.jar b -f {0} {1}', src, apk);
    logger.info('>start pack: ' + cmd);
    cd(getToolPath());
    exec(cmd, options);
    return true;
  }
}
// exports.pack('D:\\Workspace\\Code\\9game\\ninegameclient\\apad-h5\\dist\\cn.ninegame.gamemanager.apk','D:\\Workspace\\Code\\9game\\ninegameclient\\apad-h5\\dist\\cn.ninegame.gamemanager');

/**
 * 把zip打包到apk
 * @param  {String} apk    原始apk路径
 * @param  {String} zip    html.zip路径
 * @param  {String} dest   目标apk路径,若为空则覆盖原有
 * @param  {Boolean} remain 是否保留解包目录, 默认为false
 */
exports.repack = function(apk, zip, dest, remain){
  apk = getAbsolutePath(apk);
  zip = getAbsolutePath(zip);
  dest = getAbsolutePath(dest||apk);
  if(!test('-e', apk) || path.extname(apk)!='.apk'){
    logger.error('apk not exist or not .apk file: %s', apk);
    return false;
  }else if(!test('-e', zip) || path.extname(zip)!='.zip'){
    logger.error('zip not exist or not .zip file: %s', zip);
    return false;
  }else{
    var name = path.basename(apk, '.apk');
    var dir = process.cwd();
    //解包
    exports.unpack(apk, dir);
    //复制zip到assets目录
    var unpackPath = path.join(dir, name);
    cp('-f', zip, path.join(unpackPath, 'assets', 'html.zip'));
    //打包
    exports.pack(dest, unpackPath);
    if(!remain){
      rm('-rf', unpackPath);
    }
    //签名
    exports.sign(dest, path.join(getToolPath(), 'test.keystore'), '123456');
    return true;
  }
}
/**
 * 对apk签名
 * @param  {String} apk  要签名的apk路径
 * @param  {String} keystore  keystore文件的路径
 * @param  {String} pass keystore的密码
 */
exports.sign = function(apk, keystore, pass, options){
  if(!keystore){
    keystore = path.join(getToolPath(), 'test.keystore');
    pass = '123456';
  }
  apk = getAbsolutePath(apk);
  keystore = getAbsolutePath(keystore);
  if(!test('-e', apk)){
    logger.error('apk not exist: %s', apk);
    return false;
  }if(!test('-e', keystore)){
    logger.error('keystore not exist: %s', keystore);
    return false;
  }else{
    var cmd = formatStr('jarsigner -verbose -sigalg MD5withRSA -digestalg SHA1 -keystore {1} -storepass {2} {0}  test', apk, keystore, pass);
    logger.info('>start sign: ' + cmd);
    exec(cmd, options);
    return true;
  }
}
// exports.sign('D:\\Workspace\\Code\\9game\\ninegameclient\\apad-h5\\dist\\cn.ninegame.gamemanager.apk', 'D:\\Workspace\\Code\\9game\\ninegameclient\\apad-h5\\tools\\test.keystore', '123456');

/**
 * 列出android设备
 */
exports.devices = function(options){
  var cmd = 'adb devices';
  logger.debug('>' + cmd);
  exec(getToolPath() + '/' + cmd, options);
  return true;
}

/**
 * 安装apk
 * @param  {String} apk apk路径
 */
exports.install = function(apk, options){
  apk = getAbsolutePath(apk);
  if(!test('-e', apk)){
    logger.error('apk not exist: %s', apk);
    return false;
  }else{
    var cmd = formatStr('adb install {0}', apk);
    logger.info('>' + cmd);
    exec(getToolPath() + '/' + cmd, options);
    return true;
  }
}
// exports.install('D:\\Workspace\\Code\\9game\\ninegameclient\\apad-h5\\dist\\cn.ninegame.gamemanager.apk');

/**
 * 卸载apk
 * @param  {String} apkName apk名称, 而不是apk路径
 */
exports.uninstall = function(apkName, options){
  //当给出的是apk路径时,抽取出apkName
  if(test('-e', apkName)){
    //logger.warning('should giving apkName not apkPath: %s', apkName);
    apkName = path.basename(apkName, '.apk');
  }
  var cmd = formatStr('adb uninstall {0}', apkName);
  logger.debug('>' + cmd);
  exec(getToolPath() + '/' + cmd, options);
  return true;
}
// exports.uninstall('D:\\Workspace\\Code\\9game\\ninegameclient\\apad-h5\\dist\\cn.ninegame.gamemanager.apk');
// exports.uninstall('cn.ninegame.gamemanager');

/**
 * 启动apk
 * @param  {String} activity 启动的apkName或activity
 */
exports.startup = function(activity, options){
  //当给出的是apk路径时,抽取出apkName
  if(test('-e', activity)){
    activity = path.basename(activity, '.apk');
  }
  //当给出的是apkName时,组装为activity
  if(activity.indexOf('/') == -1){
    activity = formatStr('{0}/{0}.UserGuideActivity', activity);
  }

  var cmd = formatStr('adb shell am start -n "{0}"', activity);
  logger.debug('>' + cmd);
  exec(getToolPath() + '/' + cmd, options);
  return true;
}
// exports.startup('cn.ninegame.gamemanager');

//TODO: 检查version文件

/**
 * 检查apk/zip包中的页面模板包的自述文件
 * @param  {String} archive apk/zip文件的路径
 */
exports.checkPackage = function(archive){
  archive = getAbsolutePath(archive);
  //检查目标是否存在
  if(!test('-e', archive)){
    logger.error('archive no exsit: %s', archive);
    return false;
  }

  var name = path.basename(archive).replace(/\.(zip|apk)$/, '');
  var extname = path.extname(archive);
  var tmp = path.join(tempdir(), name);
  var htmlPath;
  var unzipHtmlPath;

  //是apk还是zip?
  if(extname == '.apk'){
    var unpackPath = tmp;
    //解包
    exports.unpack(archive, unpackPath, {silent:true});
    htmlPath = path.join(unpackPath, 'assets', 'html.zip');
    unzipHtmlPath = path.join(unpackPath, 'assets', 'html');
  }else if(extname == '.zip'){
    htmlPath = archive;
    unzipHtmlPath = tmp;
  }else{
    logger.error('unkown filetype: %s', extname);
    return false;
  }

  //解压
  exports.unzip(htmlPath, unzipHtmlPath, true, {silent:true});

  //读取package.json
  var packagePath = path.join(unzipHtmlPath, 'package.json');
  if(!test('-e', packagePath)){
    logger.error('package.json no exsit: %s', packagePath);
    return false;
  }else{
    var json = require(packagePath);
    var prop = ['name', 'version', 'platform', 'appVersion', 'tplVersionCode', 'appName', 'appDescription', 'appFlag'];
    var str = JSON.stringify(json, prop, '  ');
    logger.info('package.json = %s', str);

    //检查是否丢失属性
    var result = !prop.some(function(p){
      if(!json.hasOwnProperty(p)){
        logger.warn('miss prop: %s', p);
        return true;
      }
    });
    return result;
  }
}
// exports.checkPackage('D:\\Workspace\\Code\\9game\\ninegameclient\\apad-h5\\dist\\cn.ninegame.gamemanager.apk');
// exports.checkPackage('D:\\Workspace\\Code\\9game\\ninegameclient\\apad-h5\\dist\\html-dev.zip');

/**
 * 格式化字符串模版,支持2种格式:
 *
 * - formatStr("i can speak {language} since i was {age}",{language:'javascript',age:10});
 * - formatStr("i can speak {0} since i was {1}",'javascript',10);
 *
 * 如果不希望被转义,则用两个括号,如: `formatStr("i can speak {0} since i was {{1}",'javascript',10);`
 */
function formatStr(tpl,obj){
  obj = typeof obj === 'object' ? obj : Array.prototype.slice.call(arguments, 1);
  return tpl.replace(/\{\{|\}\}|\{(\w+)\}/g, function (m, n) {
    if (m == "{{") { return "{"; }
    if (m == "}}") { return "}"; }
    return obj.hasOwnProperty(n) ? obj[n] : '';
  });
};
exports.formatStr = formatStr;

/**
 * 获取工具目录
 */
function getToolPath(){
  return path.join(__dirname, 'tools');
}
exports.getToolPath = getToolPath;

/**
 * 获取绝对路径
 */
function getAbsolutePath(src){
  return /^(?:[A-Za-z]:)?\\/.test(src) ? src : path.join(process.cwd(), src);
}

/**
 * format date.
 *
 *     formatDate(new Date(),"yyyy-MM-dd hh:mm:ss")
 *     formatDate(new Date().setHours(0,0,0,0),"yyyy-MM-dd hh:mm:ss")
 *
 * 更建议用类库: [moment.js](http://momentjs.com/)
 *
 * @param {Date/Number} obj date to format, support Date or timestamp
 * @param {String} [format] 格式
 * @return {String} 格式化后的字符串
 */
function formatDate(obj,format){
  var date = obj || new Date();
  if(obj && toString.call(obj) !== '[object Date]'){
    date = new Date();
    date.setTime(obj);
  }
  format = format || "yyyy-MM-dd hh:mm:ss";

  var o = {
    "M+" : date.getMonth()+1, //month
    "d+" : date.getDate(),    //day
    "h+" : date.getHours(),   //hour
    "m+" : date.getMinutes(), //minute
    "s+" : date.getSeconds(), //second
    "q+" : Math.floor((date.getMonth()+3)/3),  //quarter
    "S" : date.getMilliseconds() //millisecond
  }
  if(/(y+)/.test(format)){
    format=format.replace(RegExp.$1, (date.getFullYear()+"").substr(4 - RegExp.$1.length));
  }
  for(var k in o){
    if(new RegExp("("+ k +")").test(format)){
      format = format.replace(RegExp.$1, RegExp.$1.length==1 ? o[k] : ("00"+ o[k]).substr((""+ o[k]).length));
    }
  }
  return format;
};
exports.formatDate = formatDate;