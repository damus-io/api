{ pkgs ? import <nixpkgs> {} }:
with pkgs;
mkShell {
  buildInputs = [ nodejs_22 jq ] ++ (with python3Packages; [ pandas matplotlib plotly ]);
}
