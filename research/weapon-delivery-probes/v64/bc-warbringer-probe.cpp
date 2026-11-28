#include <algorithm>
#include <iostream>
#include <string>
#include <vector>
#include "bwgame.h"
using namespace bwgame;
int main(int argc,char**argv){
 if(argc!=5)return 2;
 game_player p;data_loading::data_files_loader<> files;
 for(auto f:{"patch_rt.mpq","BrooDat.mpq","StarDat.mpq"})files.add_mpq_file(a_string("StarEdit/")+f);
 p.init(files);p.load_map_file("motion-lab.scx");auto& f=p.funcs();
 for(int i=0;i<12;i++)p.next_frame();
 auto* u=f.trigger_create_unit(f.get_unit_type(UnitTypes(std::stoi(argv[1]))),{600,704},0);
 const int tx=600+std::stoi(argv[2]); 
 auto* t=f.trigger_create_unit(f.get_unit_type(UnitTypes::Protoss_High_Templar),{tx,704},1);
 if(!u||!t)return 3;
 std::vector<unit_t*> scarabs;
 const int n=std::stoi(argv[3]);
 t->hp=fp8::integer(1000);
 for(int i=0;i<n;++i){
  auto* s=f.create_completed_unit(f.get_unit_type(UnitTypes::Protoss_Scarab),{550+i*9,760},0);
  if(!s)return 4;
  f.hide_unit(s);
  s->fighter.parent=u;
  s->fighter.is_outside=false;
  u->reaver.inside_units.push_front(*s);
  ++u->reaver.inside_count;
  scarabs.push_back(s);
 }
 std::cerr<<"cap_base="<<f.unit_max_scarab_count(u)<<" ammo="<<f.unit_scarab_count(u)
 <<" upgrade_level="<<p.st().upgrade_levels[0][UpgradeTypes::Reaver_Capacity]<<'\n';
 f.set_unit_heading(u,direction_t::from_raw(64));
 f.set_unit_order(u,u->unit_type->attack_unit,t);
 const std::string motion=argv[4];bool moved=false;
 std::cout<<"frame,reaverX,reaverY,tgtX,tgtY,tgtHull,tgtShield,inside,outside,cooldown,scarabs(index:x:y:order:state:remove:outside)\n";
 for(int i=0;i<=180;i++){
  std::cout<<i<<','<<u->position.x<<','<<u->position.y<<','<<t->position.x<<','<<t->position.y<<','<<t->hp.raw_value<<','<<t->shield_points.raw_value<<','<<u->reaver.inside_count<<','<<u->reaver.outside_count<<','<<u->main_order_timer<<',';
  for(auto* q:scarabs)if(q->fighter.parent==u && q->fighter.is_outside) std::cout<<q->index<<':'<<q->position.x<<':'<<q->position.y<<':'<<int(q->order_type->id)<<':'<<q->order_state<<':'<<q->remove_timer<<':'<<q->fighter.is_outside<<';';
  std::cout<<'\n';
  if(!moved && u->reaver.outside_count){
   if(motion=="teleport")f.move_unit(t,xy(tx,1004));
   else if(motion=="far")f.move_unit(t,xy(tx,1504));
   moved=true;
  }
  p.next_frame();
 }
}
