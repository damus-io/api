{ pkgs ? import <nixpkgs> {} }:
with pkgs;
mkShell {
  buildInputs = [ nodejs_20 node2nix jq ] ++ (with python3Packages; [ pandas matplotlib plotly ]);
}
