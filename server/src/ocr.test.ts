import { describe,expect,it } from 'vitest';
import { parsePlayers,VisionText } from './ocr';
function word(text:string,x:number,y:number){return {text,x,y};}
describe('weekly ranking OCR parser',()=>{
  it('parses game rows and keeps exact score digits, without avatars',()=>{
    const image:VisionText={width:709,height:1536,raw:'',words:[
      word('1',143,644),word('КРОСТ',244,644),word('1,642,222',420,644),word('pts',550,644),
      word('2',143,737),word('lollipop',244,737),word('749,263',420,737),word('pts',530,737),
      word('6',143,1092),word('didmetal',244,1092),word('325,867',420,1092),word('pts',530,1092),
      word('Daily',240,1200),word('Weekly',390,1200)
    ]};
    expect(parsePlayers(image).players).toEqual([
      {position:1,name:'КРОСТ',points:1642222,source:0},
      {position:2,name:'lollipop',points:749263,source:0},
      {position:6,name:'didmetal',points:325867,source:0}
    ]);
  });
});
