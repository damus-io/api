{ pkgs ? import <nixpkgs> {} }:
with pkgs;
mkShell {
  buildInputs = [ node2nix jq ] ++ (with python3Packages; [ pandas matplotlib plotly ]);
}
