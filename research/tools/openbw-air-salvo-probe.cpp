// Isolated Brood War proxy fixture. Compile against pinned OpenBW at 4b046d5.
// Run in the motion fixture directory with the official StarEdit data packs.
#include <algorithm>
#include <iostream>
#include <string>
#include <vector>
#include "bwgame.h"
using namespace bwgame;
int main(int argc,char** argv) {
  if(argc!=4 && argc!=5) return 2;
  game_player p;
  data_loading::data_files_loader<> files;
  for(auto f: {"patch_rt.mpq","BrooDat.mpq","StarDat.mpq"}) files.add_mpq_file(a_string("StarEdit/")+f);
  p.init(files);p.load_map_file("motion-lab.scx");
  auto& f=p.funcs(); const int tx=600+std::stoi(argv[3]);
  auto* u=f.trigger_create_unit(f.get_unit_type(UnitTypes(std::stoi(argv[1]))),{600,704},0);
  auto* t=f.trigger_create_unit(f.get_unit_type(UnitTypes(std::stoi(argv[2]))),{tx,704},1);
  if(!u||!t)return 3;
  for(int i=0;i<12;i++)p.next_frame();
  f.set_unit_heading(u,direction_t::from_raw(64));
  f.set_unit_order(u,f.get_order_type(Orders::AttackUnit),t);
  std::cout<<"frame,src_x,src_y,dst_x,dst_y,dst_hp_raw,dst_shield_raw,own_projectiles(index:weapon:x:y:state)\n";
  bool changed=false;
  for(int i=0;i<160;i++){
    std::vector<const bullet_t*> bullets;
    for(const auto& q:p.st().active_bullets) if(q.bullet_owner_unit==u) bullets.push_back(&q);
    std::sort(bullets.begin(),bullets.end(),[](auto* a,auto* b){return a->index<b->index;});
    std::cout<<i<<','<<u->position.x<<','<<u->position.y<<','<<t->position.x<<','<<t->position.y<<','<<t->hp.raw_value<<','<<t->shield_points.raw_value<<',';
    for(auto* q:bullets) std::cout<<q->index<<':'<<int(q->weapon_type->id)<<':'<<q->position.x<<':'<<q->position.y<<':'<<q->bullet_state<<';';
    std::cout<<'\n';
    if(argc==5 && !changed && !bullets.empty()){
      f.set_unit_order(t,f.get_order_type(Orders::Move),xy(tx,704+std::stoi(argv[4])));
      changed=true;
    }
    if(u->hp.raw_value<=0||t->hp.raw_value<=0)break;
    p.next_frame();
  }
}
