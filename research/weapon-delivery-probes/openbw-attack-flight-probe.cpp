// Isolated timing probe for pinned OpenBW. Run beside motion-lab.scx and the StarEdit data archives.
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
  for(int i=0;i<12;i++)p.next_frame(); // Before spawning, to avoid phase-0 automatic attacks.
  const UnitTypes source=UnitTypes(std::stoi(argv[1])), target=UnitTypes(std::stoi(argv[2]));
  auto* u=f.trigger_create_unit(f.get_unit_type(source),{600,704},0);
  auto* t=f.trigger_create_unit(f.get_unit_type(target),{tx,704},1);
  if(!u||!t)return 3;
  f.set_unit_heading(u,direction_t::from_raw(64));
  f.set_unit_order(u,f.get_order_type(Orders::AttackUnit),t);
  std::cout<<"frame,src_x,src_y,dst_x,dst_y,dst_hp_raw,dst_shield_raw,own_projectiles(index:weapon:x:y:state:aimX:aimY:targetIndex:nextSpeed)\n";
  bool changed=false;
  int bullet_index=-1;
  for(int i=0;i<=115;i++){
    std::vector<const bullet_t*> bullets;
    for(const auto& q:p.st().active_bullets)
      if(q.bullet_owner_unit==u || (bullet_index>=0 && int(q.index)==bullet_index)) bullets.push_back(&q);
    std::sort(bullets.begin(),bullets.end(),[](auto* a,auto* b){return a->index<b->index;});
    std::cout<<i<<','<<u->position.x<<','<<u->position.y<<','<<t->position.x<<','<<t->position.y<<','<<t->hp.raw_value<<','<<t->shield_points.raw_value<<',';
    for(auto* q:bullets) std::cout<<q->index<<':'<<int(q->weapon_type->id)<<':'<<q->position.x<<':'<<q->position.y<<':'<<q->bullet_state<<':'<<q->move_target.pos.x<<':'<<q->move_target.pos.y<<':'<<(q->bullet_target?q->bullet_target->index:-1)<<':'<<q->next_speed.raw_value<<';';
    std::cout<<'\n';
    if(bullet_index<0 && !bullets.empty()) bullet_index=int(bullets.front()->index);
    if(argc==5 && !changed && !bullets.empty()){
      const std::string motion=argv[4];
      if(motion=="killtarget") f.kill_unit(t);
      else if(motion=="killshooter") f.kill_unit(u);
      else if(motion=="teleportfar") f.move_unit(t,xy(tx,1504));
      else if(motion=="teleport") f.move_unit(t,xy(tx,1004));
      else f.set_unit_order(t,f.get_order_type(Orders::Move),xy(tx,704+std::stoi(argv[4])));
      changed=true;
    }
    p.next_frame();
  }
}
