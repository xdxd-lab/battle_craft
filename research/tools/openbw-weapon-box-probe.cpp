// Read-only distance probe for pinned OpenBW, revision 4b046d5. Uses only
// synthetic sprite anchors and loaded DAT types, not orders or live clients.
#include <iostream>
#include "bwgame.h"
using namespace bwgame;
int main() {
  game_player p;
  data_loading::data_files_loader<> files;
  for(auto name: {"patch_rt.mpq","BrooDat.mpq","StarDat.mpq"})
    files.add_mpq_file(a_string("StarEdit/")+name);
  p.init(files);
  p.load_map_file("motion-lab.scx");
  auto& f=p.funcs();
  const int ids[]={0,66,43,38,68,8,12,70,47};
  unit_t a{},b{}; sprite_t sa{},sb{}; a.sprite=&sa;b.sprite=&sb;
  sa.position={700,700};
  for(int i:ids)for(int j:ids){
    a.unit_type=f.get_unit_type(UnitTypes(i)); b.unit_type=f.get_unit_type(UnitTypes(j));
    for(int dx:{-239,-129,-67,0,43,128,244})for(int dy:{-143,-38,0,57,171}){
      sb.position={700+dx,700+dy};
      std::cout<<i<<','<<j<<','<<dx<<','<<dy<<','<<f.units_distance(&a,&b)<<'\n';
    }
  }
}
