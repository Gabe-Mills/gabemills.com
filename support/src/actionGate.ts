// Serialize writes and ignore completions after leaving a conversation/signing out.
export function createActionGate() {
 let mounted=true,sequence=0,active:number|null=null;
 return {
  begin():number|null {if(!mounted||active!==null)return null;active=++sequence;return active;},
  isCurrent(id:number):boolean {return mounted&&active===id;},
  finish(id:number):boolean {if(!mounted||active!==id)return false;active=null;return true;},
  invalidate():void {mounted=false;active=null;}
 };
}
