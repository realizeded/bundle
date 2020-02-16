const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const babel = require('@babel/core');
function redModule(entry) {
    let content = fs.readFileSync(entry,'utf-8');
    let ast = parser.parse(content,{
        sourceType:'module'
    });
    const dependencies ={};
    traverse(ast,{
        ImportDeclaration({node}) {
            dependencies[node.source.value]=path.dirname(entry)+node.source.value.slice(1);
        }
    });
    let code = babel.transformFromAst(ast,null,{
        "presets":["@babel/preset-env"]
    }).code;
    return {
        filename:entry,
        dependencies,
        code
    }
}
function makeDependenciesGraph(entry) {
    let root  = redModule(entry);
    let graph = [root];
    for(let i = 0; i < graph.length; i++)
    {
        let item = graph[i];
        let des = item.dependencies;
        if(des)
        {
            for(let key in des)
            {
                if(des.hasOwnProperty(key))
                {
                    graph.push(redModule(des[key]));
                }
            }
        }
    }
    const obj = {};
    graph.forEach(item=>{
        obj[item.filename] = {
            dependencies:item.dependencies,
            code:item.code
        }
    });
   return obj;
}
function generatorCode(entry)
{
    let graph = JSON.stringify(makeDependenciesGraph(entry));
    return `
    (function(graph){
       function require(entry) {
        function toResolvedPath(relativePath)
         {
             return require(graph[entry].dependencies[relativePath]);
             }
             var exports = {};
            (function(require,code,exports){
                     eval(code);
                })(toResolvedPath,graph[entry].code,exports);
                return exports;
       }
       require('${entry}')
       })(${graph});
    `;
}
let code = generatorCode('./src/index.js');
code = fs.readFileSync(path.join(__dirname,'index.html'),'utf-8').replace('${module}',code);
fs.writeFile(path.join(__dirname,'index.html'),code,'utf-8',()=>{
    console.log('打包完成');
});