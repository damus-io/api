{ pkgs ? import <nixpkgs> {} }:
with pkgs;
mkShell {
  buildInputs = [ node2nix ] ++ (with python3Packages; [ pandas matplotlib plotly ]);
}
