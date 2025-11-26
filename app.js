const productList = document.querySelector('#products');
const addProductForm = document.querySelector('#add-product-form');
const submitButton = document.querySelector('#submit-button');
const formTitle = document.querySelector('#form-title');
const cancelEditButton = document.querySelector('#cancel-edit');

let editingId = null; // null = modo Add; id = modo Update
let editingOriginal = null; // armazena os valores originais ao entrar em edição

// Function to fetch all products from the server
async function fetchProducts() {
  const response = await fetch('http://98.81.26.206:3000/products');
  const products = await response.json();

  // Clear product list
  productList.innerHTML = '';

  // Add each product to the list
  products.forEach(product => {
    const li = document.createElement('li');
    li.className = 'product-item';

    // header: título (nome + preço) + controles (botões) à direita
    const header = document.createElement('div');
    header.className = 'product-header';

    const title = document.createElement('span');
    title.className = 'product-title';
    title.textContent = `${product.name} - $${product.price}`;

    const controls = document.createElement('div');
    controls.className = 'product-controls';

    const updateButton = document.createElement('button');
    updateButton.textContent = 'Update';
    updateButton.addEventListener('click', () => {
      addProductForm.elements['name'].value = product.name || '';
      addProductForm.elements['price'].value = product.price || '';
      addProductForm.elements['description'].value = product.description || '';
      editingId = product.id;
      // guarda os valores originais para comparação
      editingOriginal = {
        name: (product.name != null) ? String(product.name).trim() : '',
        price: (product.price != null) ? String(product.price).trim() : '',
        description: (product.description != null) ? String(product.description).trim() : ''
      };
      formTitle.textContent = 'Update Product';
      submitButton.textContent = 'Update Product';
      cancelEditButton.style.display = 'inline-block';
      addProductForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', async () => {
      // chama o delete no servidor e remove o li só se deu certo
      const ok = await deleteProduct(product.id);
      if (ok) {
        li.remove();
      } else {
        alert('Erro ao deletar. Veja console.');
      }
    });

    controls.appendChild(updateButton);
    controls.appendChild(deleteButton);

    header.appendChild(title);
    header.appendChild(controls);

    // NÃO mostra a descrição na lista (apenas o header com controles)
    li.appendChild(header);

    productList.appendChild(li);
  });
}

// Event listener for Add Product form submit button (agora lida com Add e Update)
addProductForm.addEventListener('submit', async event => {
  event.preventDefault();
  const name = addProductForm.elements['name'].value;
  const priceRaw = addProductForm.elements['price'].value;
  const description = addProductForm.elements['description']
    ? addProductForm.elements['description'].value
    : '';

  const priceNum = priceRaw === '' ? null : parseFloat(priceRaw);
  if (priceRaw !== '' && Number.isNaN(priceNum)) {
    console.error('Price inválido:', priceRaw);
    return;
  }

  const current = {
    name: (name != null) ? String(name).trim() : '',
    price: (priceNum != null) ? priceNum : '',
    description: (description != null) ? String(description).trim() : ''
  };

  if (editingId) {
    if (editingOriginal &&
        editingOriginal.name === current.name &&
        editingOriginal.price === String(current.price) &&
        editingOriginal.description === current.description) {
      editingId = null;
      editingOriginal = null;
      addProductForm.reset();
      addProductForm.elements['name'].focus();
      formTitle.textContent = 'Add Product';
      submitButton.textContent = 'Add';
      cancelEditButton.style.display = 'none';
      console.log('Nenhuma alteração detectada — atualização ignorada.');
      return;
    }

    console.log('Enviando update para', editingId, 'payload:', current);
    const ok = await updateProduct(editingId, current.name, current.price, current.description);
    if (!ok) {
      console.error('Update falhou — verifique Network/Console do servidor.');
      return; // não atualiza a lista se falhou
    }
    editingOriginal = null;
  } else {
    await addProduct(current.name, current.price, current.description);
  }

  // atualizar lista
  await fetchProducts();

  // limpar campos e voltar para Add
  editingId = null;
  addProductForm.reset();
  addProductForm.elements['name'].focus();
  formTitle.textContent = 'Add Product';
  submitButton.textContent = 'Add';
  cancelEditButton.style.display = 'none';
});

// Function to add a new product (envia description também)
async function addProduct(name, price, description) {
  const payload = { name, description };
  if (price !== '' && price != null) payload.price = Number(price);

  const response = await fetch('http://98.81.26.206:3000/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => null);

  if (response.ok) {
    // limpar campos imediatamente após inserção bem-sucedida
    addProductForm.reset();
    addProductForm.elements['name'].focus();
  } else {
    console.error('erro ao adicionar', response.status, data);
    // sem alert para evitar popup intrusivo
  }

  return data;
}

// Function to delete a product
async function deleteProduct(id) {
  try {
    const response = await fetch('http://98.81.26.206:3000/products/' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) {
      console.error('delete error', response.status, await response.text());
      return false;
    }

    return true;
  } catch (err) {
    console.error('delete exception', err);
    return false;
  }
}

// Cancel edit
cancelEditButton.addEventListener('click', () => {
  editingId = null;
  editingOriginal = null;
  addProductForm.reset();
  formTitle.textContent = 'Add Product';
  submitButton.textContent = 'Add';
  cancelEditButton.style.display = 'none';
  addProductForm.elements['name'].focus();
});

// Function to update a product (PATCH) - agora retorna boolean e loga resposta
async function updateProduct(id, name, price, description) {
  const payload = { name, description };
  if (price !== '' && price != null) payload.price = Number(price);

  try {
    console.log('Request PATCH /products/' + id, payload);
    let res = await fetch('http://98.81.26.206:3000/products/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // se PATCH não for permitido, tenta PUT
    if (res.status === 405) {
      console.warn('PATCH não suportado — tentando PUT');
      res = await fetch('http://98.81.26.206:3000/products/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    // aceita 204 No Content também
    const text = await res.text().catch(() => null);
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }

    console.log('Resposta update status:', res.status, 'body:', data);

    if (!res.ok) {
      console.error('update erro', res.status, data);
      return false;
    }

    // opcional: retorna o objeto atualizado (se servidor retornar)
    return data || true;
  } catch (err) {
    console.error('update exception', err);
    return false;
  }
}

// Fetch all products on page load
fetchProducts();
