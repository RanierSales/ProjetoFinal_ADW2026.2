function somenteDigitos(v) {
  return String(v || '').replace(/\D/g, '');
}

function cnpjValido(valor) {
  const c = somenteDigitos(valor);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const digito = (tamanho) => {
    let soma = 0;
    let peso = tamanho - 7;
    for (let i = 0; i < tamanho; i++) {
      soma += Number(c[i]) * peso--;
      if (peso < 2) peso = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return digito(12) === Number(c[12]) && digito(13) === Number(c[13]);
}

module.exports = { somenteDigitos, cnpjValido };
