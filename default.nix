{ pkgs ? import <nixpkgs> {
    inherit system;
  }, system ? builtins.currentSystem, nodejs ? pkgs."nodejs_22"}:

pkgs.buildNpmPackage {
  pname = "damus-api";
  version = "0.1.0";

  src = pkgs.nix-gitignore.gitignoreSource [ ] ./.;

  inherit nodejs;

  # Regenerate with ./nixify after changing package-lock.json.
  npmDepsHash = "sha256-ZmPJ61bymLoE7NaB9aSF+PL0kyg6mT5xFqhfy9BJKcI=";

  # Nothing to build; the Makefile drives reports and ctags, not the package.
  # dontNpmBuild alone would hand the build phase back to stdenv, which then
  # runs make and fails on the default 'tags' target.
  dontNpmBuild = true;
  dontBuild = true;
}
