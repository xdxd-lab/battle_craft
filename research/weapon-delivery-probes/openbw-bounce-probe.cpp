// Isolated Mutalisk impact/bounce probe. Compile and run as the companion attack-flight fixture.
#include <array>
#include <iostream>
#include <string>
#include "bwgame.h"
using namespace bwgame;
int main(int argc,char** argv) {
 if(argc!=2) return 2;
 game_player p;
 data_loading::data_files_loader<> files;
 for(auto f: {"patch_rt.mpq","BrooDat.mpq","StarDat.mpq"}) files.add_mpq_file(a_string("StarEdit/")+f);
 p.init(files);p.load_map_file("motion-lab.scx");
 for(int i=0;i<12;i++)p.next_frame();
 auto& f=p.funcs();
 auto* u=f.trigger_create_unit(f.get_unit_type(UnitTypes(43)),{600,704},0);
 if(!u) return 3;
 std::array<unit_t*,4> t;
 std::array<xy,4> pos{xy(700,704),xy(734,710),xy(670,770),xy(810,742)};
 for(int i=0;i<4;i++){
  t[i]=f.trigger_create_unit(f.get_unit_type(UnitTypes(34)),pos[i],1);
  if(!t[i])return 3;
  std::cout<<"target"<<i<<':'<<t[i]->index<<':'<<t[i]->position.x<<':'<<t[i]->position.y<<'\n';
 }
 f.set_unit_heading(u,direction_t::from_raw(64));
 f.set_unit_order(u,f.get_order_type(Orders::AttackUnit),t[0]);
 const std::string mode=argv[1];
 bool changed=false;
 std::cout<<"frame,src_alive,target0_raw,target1_raw,target2_raw,target3_raw,projectiles(index:kind:target:x:y:bounces:state)\n";
 for(int i=0;i<32;i++){
  std::cout<<i<<','<<(u->hp.raw_value>0);
  for(auto* v:t)std::cout<<','<<v->hp.raw_value;
  std::cout<<',';
  bool flying=false;
  for(const auto& q:p.st().active_bullets) if(q.owner==0){
   std::cout<<q.index<<':'<<int(q.weapon_type->id)<<':'<<(q.bullet_target?int(q.bullet_target->index):-1)<<':'<<q.position.x<<':'<<q.position.y<<':'<<q.remaining_bounces<<':'<<q.bullet_state<<';';
   flying=true;
  }
  std::cout<<'\n';
  if(flying&&!changed){
   changed=true;
   if(mode=="killshooter")f.kill_unit(u);
   if(mode=="killprimary")f.kill_unit(t[0]);
  }
  p.next_frame();
 }
}
